import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

const VALID_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
const VALID_RESOURCES = ['customer', 'service', 'partner', 'user', 'settings', 'serviceType'] as const;

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    cursor,
    limit = '25',
    action,
    resource,
    userId,
    from,
    to,
  } = req.query as Record<string, string | undefined>;

  const take = Math.min(parseInt(limit ?? '25', 10) || 25, 100);
  const where: Record<string, unknown> = {};

  if (action) {
    if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
      res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
      return;
    }
    where.action = action;
  }

  if (resource) {
    if (!(VALID_RESOURCES as readonly string[]).includes(resource)) {
      res.status(400).json({ error: `Invalid resource. Must be one of: ${VALID_RESOURCES.join(', ')}` });
      return;
    }
    where.resource = resource;
  }

  if (userId) {
    where.userId = userId;
  }

  if (from || to) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    where.createdAt = createdAt;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    take: take + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const hasMore = logs.length > take;
  if (hasMore) logs.pop();

  res.json({
    data: logs,
    nextCursor: hasMore ? logs[logs.length - 1].id : null,
  });
}

export default withAdmin(handler);
