import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { verifyPassword, hashPassword, checkStrength } from '@/lib/password';
import { createRateLimiter } from '@/lib/rateLimit';
import { isValidLocale } from '@/lib/i18n';

// 5 password change attempts per 15 minutes per user
const passwordChangeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' });
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

  // Handle locale update
  if (locale !== undefined) {
    if (!isValidLocale(locale)) {
      res.status(400).json({ error: 'Invalid locale' });
      return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { locale },
    });
    result.locale = locale;
  }

  // Handle name update
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Name must be a non-empty string' });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { name: true },
    });
    result.name = updated.name;
  }

  // Handle password change
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

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, firstLogin: false },
    });
    result.firstLogin = false;
  }

  if (Object.keys(result).length === 1) {
    res.status(400).json({ error: 'No update fields provided' });
    return;
  }

  res.json(result);
}

export default withAuth(handler);
