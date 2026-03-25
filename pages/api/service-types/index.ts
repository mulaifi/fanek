import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { serviceTypeSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method === 'GET') {
    const { active } = req.query;
    const where: Record<string, unknown> = {};
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

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAuth(handler);
