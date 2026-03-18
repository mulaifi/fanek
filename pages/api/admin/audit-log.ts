import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { withAdmin, type AuthenticatedRequest } from '@/lib/auth/guard';

import prisma from '@/lib/prisma';

const VALID_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
const VALID_RESOURCES = ['customer', 'service', 'partner', 'user', 'settings', 'serviceType'] as const;

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cursor = asQueryString(req.query.cursor);
  const limit = asQueryString(req.query.limit) ?? '25';
  const action = asQueryString(req.query.action);
  const resource = asQueryString(req.query.resource);
  const userId = asQueryString(req.query.userId);
  const from = asQueryString(req.query.from);
  const to = asQueryString(req.query.to);

  const take = Math.min(Number.parseInt(limit, 10) || 25, 100);
  const where: Prisma.AuditLogWhereInput = {};

  if (action) {
    if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
    }
    where.action = action;
  }

  if (resource) {
    if (!VALID_RESOURCES.includes(resource as (typeof VALID_RESOURCES)[number])) {
      return res.status(400).json({ error: `Invalid resource. Must be one of: ${VALID_RESOURCES.join(', ')}` });
    }
    where.resource = resource;
  }

  if (userId) {
    where.userId = userId;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const hasMore = logs.length > take;
  if (hasMore) logs.pop();

  return res.json({
    data: logs,
    nextCursor: hasMore ? logs[logs.length - 1]?.id ?? null : null,
  });
}

export default withAdmin(handler);
