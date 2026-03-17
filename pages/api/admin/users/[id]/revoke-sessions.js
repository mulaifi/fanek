import { withAdmin } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { count } = await prisma.session.deleteMany({ where: { userId: id } });

  await logAudit({
    userId: req.session.user.id,
    action: 'UPDATE',
    resource: 'user',
    resourceId: id,
    details: { action: 'sessions_revoked', sessionsDeleted: count, targetUser: user.email },
  });

  logger.info({ userId: id, count }, 'User sessions revoked by admin');

  return res.json({ success: true, sessionsRevoked: count });
}

export default withAdmin(handler);
