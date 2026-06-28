import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { checkStrength, hashPassword } from '@/lib/password';
import { verifyResetToken, consumeResetToken } from '@/lib/passwordReset';
import { methodNotAllowed } from '@/lib/auth/guard';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const { token, password } = (req.body ?? {}) as { token?: unknown; password?: unknown };
  if (typeof token !== 'string' || token === '' || typeof password !== 'string' || password === '') {
    res.status(400).json({ error: 'Token and password are required' });
    return;
  }

  // Verify the token first (without consuming it) so a valid token survives a weak
  // password attempt and the user can retry.
  const verified = await verifyResetToken(token);
  if (!verified) {
    res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    return;
  }

  const strength = checkStrength(password);
  if (!strength.valid) {
    res.status(400).json({ error: 'Weak password', details: strength.errors });
    return;
  }

  try {
    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: verified.userId },
      data: { passwordHash, firstLogin: false },
    });
    await consumeResetToken(verified.id);
    // Invalidate any other outstanding tokens for this user.
    await prisma.passwordResetToken.deleteMany({ where: { userId: verified.userId, usedAt: null } });

    await logAudit({
      userId: verified.userId,
      action: 'PASSWORD_RESET',
      resource: 'user',
      resourceId: verified.userId,
    });
    logger.info({ userId: verified.userId }, 'Password reset completed');
  } catch (err) {
    logger.error({ err }, 'reset-password processing failed');
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    return;
  }

  res.status(200).json({ success: true });
}
