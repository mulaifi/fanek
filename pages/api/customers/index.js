import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { customerSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { getSettings } from '@/lib/settings';
import logger from '@/lib/logger';

async function handler(req, res) {
  if (req.method === 'GET') {
    const ALLOWED_SORT_FIELDS = ['name', 'clientCode', 'status', 'vertical', 'createdAt', 'updatedAt'];
    const { page = '1', limit = '25', status, search, sort = 'name', order = 'asc' } = req.query;
    const validSort = ALLOWED_SORT_FIELDS.includes(sort) ? sort : 'name';
    const validOrder = ['asc', 'desc'].includes(order?.toLowerCase()) ? order.toLowerCase() : 'asc';
    const take = Math.min(parseInt(limit, 10) || 25, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { clientCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        take,
        skip,
        orderBy: { [validSort]: validOrder },
        include: { _count: { select: { services: true } } },
      }),
      prisma.customer.count({ where }),
    ]);
    return res.json({ data: customers, total });
  }

  if (req.method === 'POST') {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const settings = await getSettings();
    if (parsed.data.status) {
      const validStatuses = settings?.customerStatuses || [];
      if (!validStatuses.includes(parsed.data.status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
    }
    try {
      const customer = await prisma.customer.create({ data: parsed.data });
      await logAudit({
        userId: req.session.user.id,
        action: 'CREATE',
        resource: 'customer',
        resourceId: customer.id,
        details: { after: customer },
      });
      logger.info({ customerId: customer.id }, 'Customer created');
      return res.status(201).json(customer);
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'A customer with that client code already exists' });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
