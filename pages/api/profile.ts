import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { verifyPassword, hashPassword, checkStrength } from '@/lib/password';
import { createRateLimiter } from '@/lib/rateLimit';

// 5 password change attempts per 15 minutes per user
const passwordChangeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { currentPassword, newPassword, name } = req.body as {
    currentPassword?: string;
    newPassword?: string;
    name?: string;
  };

  // Handle name update (no password fields provided)
  if (name !== undefined && !currentPassword && !newPassword) {
    if (typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Name must be a non-empty string' });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: req.session.user.id },
      data: { name: name.trim() },
      select: { name: true },
    });
    res.json({ success: true, name: updated.name });
    return;
  }

  // Handle password change
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  const { allowed, remaining } = passwordChangeLimiter.check(req.session.user.id);
  if (!allowed) {
    res.status(429).json({ error: 'Too many password change attempts. Try again later.' });
    return;
  }
  res.setHeader('X-RateLimit-Remaining', remaining);

  const user = await prisma.user.findUnique({ where: { id: req.session.user.id } });
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

  res.json({ success: true, firstLogin: false });
}

export default withAuth(handler);
