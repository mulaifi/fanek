import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import type { Prisma } from '@prisma/client';

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
      data: { userId, action, resource, resourceId, details: details as Prisma.InputJsonValue },
    });
  } catch (err) {
    logger.error({ err, userId, action, resource, resourceId }, 'Failed to write audit log');
  }
}
