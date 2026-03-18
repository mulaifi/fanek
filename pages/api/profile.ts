import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { verifyPassword, hashPassword, checkStrength } from '@/lib/password';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

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
