import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { serviceTypeSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const serviceType = await prisma.serviceType.findUnique({
      where: { id },
      include: { _count: { select: { services: true } } },
    });
    if (!serviceType) return res.status(404).json({ error: 'Service type not found' });
    return res.json(serviceType);
  }

  if (req.method === 'PUT') {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    const existing = await prisma.serviceType.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Service type not found' });

    const parsed = serviceTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const updated = await prisma.serviceType.update({ where: { id }, data: parsed.data });
    await logAudit({
      userId: req.session.user.id,
      action: 'UPDATE',
      resource: 'serviceType',
      resourceId: id,
      details: { before: existing, after: updated },
    });
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    const existing = await prisma.serviceType.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Service type not found' });

    const serviceCount = await prisma.service.count({ where: { serviceTypeId: id } });
    if (serviceCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete service type with existing services. Deactivate it instead.',
      });
    }

    await prisma.serviceType.delete({ where: { id } });
    await logAudit({
      userId: req.session.user.id,
      action: 'DELETE',
      resource: 'serviceType',
      resourceId: id,
      details: { before: existing },
    });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
