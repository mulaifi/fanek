import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { isValidCuid } from '@/lib/validation';
import { generateTempPassword, hashPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const id = req.query.id as string;
  if (!isValidCuid(id)) {
    res.status(400).json({ error: 'Invalid user ID format' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, firstLogin: true },
  });

  await logAudit({
    userId: req.session.user.id,
    action: 'UPDATE',
    resource: 'user',
    resourceId: id,
    details: { action: 'password_reset', targetUser: user.email },
  });

  logger.info({ userId: id }, 'User password reset by admin');

  res.json({ success: true, tempPassword });
}

export default withAdmin(handler);
