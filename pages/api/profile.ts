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

  // Last-admin safeguard: never let the only remaining Admin delete themselves and
  // lock the whole organization out (mirrors the self-delete guard in the admin
  // user route, adapted for the self-service case).
  if (user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      res.status(409).json({
        error:
          'You are the only administrator. Assign the Admin role to another user before deleting your account.',
      });
      return;
    }
  }

  // Durable, FK-independent record of the deletion (the AuditLog table cannot hold a
  // row referencing a now-deleted user — see the doc comment above).
  logger.info(
    { deletedUserId: user.id, email: user.email, role: user.role },
    'Self-service account deletion'
  );

  // Erase the user's own audit entries (their personal data) and the account itself
  // atomically. Deleting the audit rows first also satisfies the RESTRICT FK.
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

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
