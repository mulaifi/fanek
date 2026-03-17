import { withAdmin } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { generateTempPassword, hashPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

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

  return res.json({ success: true, tempPassword });
}

export default withAdmin(handler);
