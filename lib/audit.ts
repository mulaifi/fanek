import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import type { Prisma } from '@prisma/client';

interface AuditLogParams {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

function sanitizeDetails(details: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (details === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(details, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (typeof value === 'function' || typeof value === 'undefined') return null;
      return value;
    })) as Prisma.InputJsonValue;
  } catch (err) {
    logger.warn({ err }, 'Failed to sanitize audit log details, storing empty object');
    return {} as Prisma.InputJsonValue;
  }
}

export async function logAudit({ userId, action, resource, resourceId, details }: AuditLogParams): Promise<void> {
  try {
    const sanitized = sanitizeDetails(details);
    await prisma.auditLog.create({
      data: { userId, action, resource, resourceId, details: sanitized as Prisma.InputJsonValue },
    });
  } catch (err) {
    logger.error({ err, userId, action, resource, resourceId }, 'Failed to write audit log');
  }
}
