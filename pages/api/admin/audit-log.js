import { withAdmin } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

const VALID_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'];
const VALID_RESOURCES = ['customer', 'service', 'partner', 'user', 'settings', 'serviceType'];

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    cursor,
    limit = '25',
    action,
    resource,
    userId,
    from,
    to,
  } = req.query;

  const take = Math.min(parseInt(limit, 10) || 25, 100);
  const where = {};

  if (action) {
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
    }
    where.action = action;
  }

  if (resource) {
    if (!VALID_RESOURCES.includes(resource)) {
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
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const hasMore = logs.length > take;
  if (hasMore) logs.pop();

  return res.json({
    data: logs,
    nextCursor: hasMore ? logs[logs.length - 1].id : null,
  });
}

export default withAdmin(handler);
