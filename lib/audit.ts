import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

interface AuditLogParams {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
}

export async function logAudit({ userId, action, resource, resourceId, details }: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId, action, resource, resourceId, details },
    });
  } catch (err) {
    logger.error({ err, userId, action, resource, resourceId }, 'Failed to write audit log');
  }
}
