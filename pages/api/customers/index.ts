import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { customerSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { getSettings } from '@/lib/settings';
import logger from '@/lib/logger';

const ALLOWED_SORT_FIELDS = ['name', 'clientCode', 'status', 'vertical', 'createdAt', 'updatedAt'] as const;

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseStatuses(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((status): status is string => typeof status === 'string');
}

function isKnownPrismaError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const page = asQueryString(req.query.page) ?? '1';
    const limit = asQueryString(req.query.limit) ?? '25';
    const status = asQueryString(req.query.status);
    const search = asQueryString(req.query.search);
    const sort = asQueryString(req.query.sort) ?? 'name';
    const order = asQueryString(req.query.order) ?? 'asc';

    const validSort = ALLOWED_SORT_FIELDS.includes(sort as (typeof ALLOWED_SORT_FIELDS)[number]) ? sort : 'name';
    const validOrder: Prisma.SortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';
    const take = Math.min(Number.parseInt(limit, 10) || 25, 100);
    const skip = (Math.max(Number.parseInt(page, 10) || 1, 1) - 1) * take;
    const where: Prisma.CustomerWhereInput = {};

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
      const validStatuses = parseStatuses(settings?.customerStatuses ?? []);
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
      if (isKnownPrismaError(err) && err.code === 'P2002') {
        return res.status(409).json({ error: 'A customer with that client code already exists' });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
