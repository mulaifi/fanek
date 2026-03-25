import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { verifyPassword, hashPassword, checkStrength } from '@/lib/password';
import { createRateLimiter } from '@/lib/rateLimit';
import { isValidLocale } from '@/lib/i18n';

// 5 password change attempts per 15 minutes per user
const passwordChangeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'PUT') {
    methodNotAllowed(res, ['PUT']);
    return;
  }

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

export default withAuth(handler);
