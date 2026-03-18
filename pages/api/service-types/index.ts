import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { serviceTypeSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const active = asQueryString(req.query.active);
    const where: Prisma.ServiceTypeWhereInput = {};
    if (active === 'true') where.active = true;
    const serviceTypes = await prisma.serviceType.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { services: true } } },
    });
    return res.json({ data: serviceTypes });
  }

  if (req.method === 'POST') {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    const parsed = serviceTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const serviceType = await prisma.serviceType.create({ data: parsed.data });
    await logAudit({
      userId: req.session.user.id,
      action: 'CREATE',
      resource: 'serviceType',
      resourceId: serviceType.id,
      details: { after: serviceType },
    });
    logger.info({ serviceTypeId: serviceType.id }, 'Service type created');
    return res.status(201).json(serviceType);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
