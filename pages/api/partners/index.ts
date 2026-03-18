import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { partnerSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

const ALLOWED_SORT_FIELDS = ['name', 'type', 'createdAt', 'updatedAt'] as const;

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isKnownPrismaError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const page = asQueryString(req.query.page) ?? '1';
    const limit = asQueryString(req.query.limit) ?? '25';
    const type = asQueryString(req.query.type);
    const search = asQueryString(req.query.search);
    const sort = asQueryString(req.query.sort) ?? 'name';
    const order = asQueryString(req.query.order) ?? 'asc';

    const validSort = ALLOWED_SORT_FIELDS.includes(sort as (typeof ALLOWED_SORT_FIELDS)[number]) ? sort : 'name';
    const validOrder: Prisma.SortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';
    const take = Math.min(Number.parseInt(limit, 10) || 25, 100);
    const skip = (Math.max(Number.parseInt(page, 10) || 1, 1) - 1) * take;
    const where: Prisma.PartnerWhereInput = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [partners, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        take,
        skip,
        orderBy: { [validSort]: validOrder },
      }),
      prisma.partner.count({ where }),
    ]);
    return res.json({ data: partners, total });
  }

  if (req.method === 'POST') {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    const parsed = partnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    try {
      const partner = await prisma.partner.create({ data: parsed.data });
      await logAudit({
        userId: req.session.user.id,
        action: 'CREATE',
        resource: 'partner',
        resourceId: partner.id,
        details: { after: partner },
      });
      logger.info({ partnerId: partner.id }, 'Partner created');
      return res.status(201).json(partner);
    } catch (err) {
      if (isKnownPrismaError(err) && err.code === 'P2002') {
        return res.status(409).json({ error: 'A partner with that name already exists' });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
