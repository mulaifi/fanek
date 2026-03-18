import type { NextApiResponse } from 'next';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { verifyPassword, hashPassword, checkStrength } from '@/lib/password';

interface ProfileUpdateBody {
  currentPassword?: string;
  newPassword?: string;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const { currentPassword, newPassword } = (req.body ?? {}) as ProfileUpdateBody;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.session.user.id } });
  if (!user || !user.passwordHash) {
    return res.status(400).json({ error: 'Password change not available for OAuth users' });
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const strength = checkStrength(newPassword);
  if (!strength.valid) {
    return res.status(400).json({ error: 'Weak password', details: strength.errors });
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, firstLogin: false },
  });

  return res.json({ success: true, firstLogin: false });
}

export default withAuth(handler);
