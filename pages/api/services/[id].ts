import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { serviceSchema, isValidCuid } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const id = req.query.id as string;
  if (!isValidCuid(id)) {
    return res.status(400).json({ error: 'Invalid service ID format' });
  }

  if (req.method === 'GET') {
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        serviceType: true,
        customer: { select: { id: true, name: true, clientCode: true } },
      },
    });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    return res.json(service);
  }

  if (req.method === 'PUT') {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Service not found' });

    const parsed = serviceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await prisma.service.update({ where: { id }, data: parsed.data as any });
    await logAudit({
      userId: req.session.user.id,
      action: 'UPDATE',
      resource: 'service',
      resourceId: id,
      details: { before: existing, after: updated },
    });
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Service not found' });

    await prisma.service.delete({ where: { id } });
    await logAudit({
      userId: req.session.user.id,
      action: 'DELETE',
      resource: 'service',
      resourceId: id,
      details: { before: existing },
    });
    return res.json({ success: true });
  }

  return methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
}

export default withAuth(handler);
