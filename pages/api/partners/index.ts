import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { partnerSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

function normalize(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method === 'GET') {
    const ALLOWED_SORT_FIELDS = ['name', 'type', 'createdAt', 'updatedAt'];
    const { page: rawPage = '1', limit: rawLimit = '25', type: rawType, search: rawSearch, sort: rawSort = 'name', order: rawOrder = 'asc' } = req.query;
    const page = normalize(rawPage);
    const limit = normalize(rawLimit);
    const type = normalize(rawType);
    const search = normalize(rawSearch);
    const sort = normalize(rawSort);
    const order = normalize(rawOrder);
    const validSort = ALLOWED_SORT_FIELDS.includes(sort ?? '') ? (sort ?? 'name') : 'name';
    const normalizedOrder = order?.toLowerCase() ?? '';
    const validOrder: 'asc' | 'desc' =
      normalizedOrder === 'asc' || normalizedOrder === 'desc' ? normalizedOrder : 'asc';
    const take = Math.min(parseInt(limit ?? '25', 10) || 25, 100);
    const skip = (Math.max(parseInt(page ?? '1', 10) || 1, 1) - 1) * take;
    const where: Record<string, unknown> = {};
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
        orderBy: { [validSort]: validOrder } as Record<string, 'asc' | 'desc'>,
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
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        return res.status(409).json({ error: 'A partner with that name already exists' });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
