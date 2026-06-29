import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { verifyPassword, hashPassword, checkStrength } from '@/lib/password';
import { createRateLimiter } from '@/lib/rateLimit';
import { isValidLocale } from '@/lib/i18n';
import logger from '@/lib/logger';

// 5 password change attempts per 15 minutes per user
const passwordChangeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
// 5 account-deletion attempts per 15 minutes per user (guards the password reconfirm)
const deleteAccountLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

/** Sentinel thrown inside the deletion transaction to abort a last-admin self-delete. */
class LastAdminError extends Error {
  constructor() {
    super('LAST_ADMIN');
    this.name = 'LastAdminError';
  }
}

async function handlePut(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const { currentPassword, newPassword, name, locale } = req.body as {
    currentPassword?: string;
    newPassword?: string;
    name?: string;
    locale?: string;
  };

  const userId = req.session.user.id;
  const result: Record<string, unknown> = { success: true };

  // ---- Validate all fields before applying any changes ----

  if (locale !== undefined && !isValidLocale(locale)) {
    res.status(400).json({ error: 'Invalid locale' });
    return;
  }

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    res.status(400).json({ error: 'Name must be a non-empty string' });
    return;
  }

  if (currentPassword || newPassword) {
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    const { allowed, remaining } = passwordChangeLimiter.check(userId);
    if (!allowed) {
      res.status(429).json({ error: 'Too many password change attempts. Try again later.' });
      return;
    }
    res.setHeader('X-RateLimit-Remaining', remaining);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      res.status(400).json({ error: 'Password change not available for OAuth users' });
      return;
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const strength = checkStrength(newPassword);
    if (!strength.valid) {
      res.status(400).json({ error: 'Weak password', details: strength.errors });
      return;
    }
  }

  // ---- All validations passed, now apply changes atomically ----

  const updateData: Record<string, unknown> = {};

  if (locale !== undefined) {
    updateData.locale = locale;
    result.locale = locale;
  }

  if (name !== undefined) {
    updateData.name = name.trim();
    result.name = name.trim();
  }

  if (currentPassword && newPassword) {
    const newHash = await hashPassword(newPassword);
    updateData.passwordHash = newHash;
    updateData.firstLogin = false;
    // Revoke all existing JWT sessions (including this one) issued before the change,
    // so a stolen token can no longer authenticate (see lib/auth/options.ts). The
    // client signs the user out and prompts a fresh login with the new password.
    updateData.sessionsValidAfter = new Date();
    result.firstLogin = false;
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: 'No update fields provided' });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  res.json(result);
}

/**
 * DELETE /api/profile — self-service account deletion (GDPR Art. 17 erasure).
 *
 * Deletes the requesting user's OWN account after re-confirming their password
 * (defense against a hijacked session or accidental click). Refuses if the user is
 * the last remaining Admin, to avoid locking the whole organization out.
 *
 * Audit handling: `AuditLog.userId` is a RESTRICT foreign key, so a user with audit
 * entries cannot be deleted while those rows exist, and no AuditLog row may reference
 * a deleted user. We therefore (1) capture the user's identity up front, (2) record
 * the deletion durably in the structured application log (which is not FK-bound and
 * so survives), and (3) erase the user's own audit entries as part of the erasure
 * before deleting the account.
 */
async function handleDelete(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const userId = req.session.user.id;

  const { password } = req.body as { password?: unknown };
  if (typeof password !== 'string' || password.length === 0) {
    res.status(400).json({ error: 'Password confirmation is required' });
    return;
  }

  const { allowed, remaining } = deleteAccountLimiter.check(userId);
  if (!allowed) {
    res.status(429).json({ error: 'Too many account deletion attempts. Try again later.' });
    return;
  }
  res.setHeader('X-RateLimit-Remaining', remaining);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (!user.passwordHash) {
    res.status(400).json({ error: 'Password confirmation is not available for OAuth accounts' });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: 'Password is incorrect' });
    return;
  }

  // Last-admin safeguard + erasure run in a single INTERACTIVE transaction so the
  // guard is atomic: without row locking, two concurrent "last admin" deletions
  // could both read count > 0 and both proceed, locking the whole org out (TOCTOU).
  // We read the role from the DB record above (never the session) and re-verify the
  // admin count INSIDE the transaction while holding a row lock on the ADMIN rows.
  try {
    await prisma.$transaction(async (tx) => {
      if (user.role === 'ADMIN') {
        // Prisma `count` cannot emit `FOR UPDATE`, so lock the ADMIN rows with a raw
        // query and count what we locked. Any concurrent self-deletion serializes
        // behind this lock, so exactly one of two last-admins can win the race.
        const lockedAdmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "User" WHERE role = 'ADMIN' FOR UPDATE
        `;
        if (lockedAdmins.length <= 1) {
          throw new LastAdminError();
        }
      }

      // Erase the user's own audit entries (their personal data) and the account
      // itself. Deleting the audit rows first also satisfies the RESTRICT FK.
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (err) {
    if (err instanceof LastAdminError) {
      res.status(409).json({
        error:
          'You are the only administrator. Assign the Admin role to another user before deleting your account.',
      });
      return;
    }
    throw err;
  }

  // Durable, FK-independent record of the deletion, written only AFTER the
  // transaction has actually committed (the AuditLog table cannot hold a row
  // referencing a now-deleted user — see the doc comment above). Email is
  // deliberately NOT logged: persisting it would defeat the erasure this records.
  logger.info({ deletedUserId: user.id, role: user.role }, 'Self-service account deletion');

  res.json({ success: true });
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method === 'PUT') {
    return handlePut(req, res);
  }
  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }
  methodNotAllowed(res, ['PUT', 'DELETE']);
}

export default withAuth(handler);
