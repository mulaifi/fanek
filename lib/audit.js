import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
export async function logAudit({ userId, action, resource, resourceId, details }) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, resource, resourceId, details },
    });
  } catch (err) {
    logger.error({ err, userId, action, resource, resourceId }, 'Failed to write audit log');
  }
}
