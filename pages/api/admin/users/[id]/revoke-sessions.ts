import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const id = req.query.id as string;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { count } = await prisma.session.deleteMany({ where: { userId: id } });

  await logAudit({
    userId: req.session.user.id,
    action: 'UPDATE',
    resource: 'user',
    resourceId: id,
    details: { action: 'sessions_revoked', sessionsDeleted: count, targetUser: user.email },
  });

  logger.info({ userId: id, count }, 'User sessions revoked by admin');

  res.json({ success: true, sessionsRevoked: count });
}

export default withAdmin(handler);
