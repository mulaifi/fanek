import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { serviceSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = asQueryString(req.query.id);
  if (!id) {
    return res.status(400).json({ error: 'Service ID is required' });
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

    const updateData: Prisma.ServiceUncheckedUpdateInput = {};
    if (parsed.data.customerId !== undefined) {
      updateData.customerId = parsed.data.customerId;
    }
    if (parsed.data.serviceTypeId !== undefined) {
      updateData.serviceTypeId = parsed.data.serviceTypeId;
    }
    if (parsed.data.startDate !== undefined) {
      updateData.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    }
    if (parsed.data.endDate !== undefined) {
      updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    }
    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes;
    }
    if (parsed.data.fieldValues !== undefined) {
      updateData.fieldValues = parsed.data.fieldValues as Prisma.InputJsonValue;
    }

    const updated = await prisma.service.update({ where: { id }, data: updateData });
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

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
