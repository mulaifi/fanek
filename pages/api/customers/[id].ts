import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { customerSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { getSettings } from '@/lib/settings';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const id = req.query.id as string;

  if (req.method === 'GET') {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        services: { include: { serviceType: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.json(customer);
  }

  if (req.method === 'PUT') {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    if (parsed.data.status) {
      const settings = await getSettings();
      const validStatuses: string[] = (settings?.customerStatuses as string[]) ?? [];
      if (!validStatuses.includes(parsed.data.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
    }
    const updated = await prisma.customer.update({ where: { id }, data: parsed.data });
    await logAudit({
      userId: req.session.user.id,
      action: 'UPDATE',
      resource: 'customer',
      resourceId: id,
      details: { before: existing, after: updated },
    });
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    await prisma.customer.delete({ where: { id } });
    await logAudit({
      userId: req.session.user.id,
      action: 'DELETE',
      resource: 'customer',
      resourceId: id,
      details: { before: existing },
    });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
