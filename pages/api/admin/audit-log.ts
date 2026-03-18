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

  const raw = req.query as Record<string, string | string[] | undefined>;
  const pick = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const cursor = pick(raw.cursor);
  const limit = pick(raw.limit) ?? '25';
  const action = pick(raw.action);
  const resource = pick(raw.resource);
  const userId = pick(raw.userId);
  const from = pick(raw.from);
  const to = pick(raw.to);

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
    if (from) {
      const d = new Date(from);
      if (isNaN(d.getTime())) {
        res.status(400).json({ error: 'Invalid "from" date format' });
        return;
      }
      createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (isNaN(d.getTime())) {
        res.status(400).json({ error: 'Invalid "to" date format' });
        return;
      }
      createdAt.lte = d;
    }
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
    nextCursor: hasMore && logs.length > 0 ? logs[logs.length - 1].id : null,
  });
}

export default withAdmin(handler);
