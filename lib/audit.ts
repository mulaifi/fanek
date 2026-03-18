import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import type { Prisma } from '@prisma/client';

interface LogAuditParams {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export async function logAudit({ userId, action, resource, resourceId, details }: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId, action, resource, resourceId, details },
    });
  } catch (err) {
    logger.error({ err, userId, action, resource, resourceId }, 'Failed to write audit log');
  }
}
