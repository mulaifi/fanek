import type { NextApiResponse } from 'next';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { partnerSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = asQueryString(req.query.id);
  if (!id) {
    return res.status(400).json({ error: 'Partner ID is required' });
  }

  if (req.method === 'GET') {
    const partner = await prisma.partner.findUnique({
      where: { id },
    });
    if (!partner) return res.status(404).json({ error: 'Partner not found' });
    return res.json(partner);
  }

  if (req.method === 'PUT') {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    const existing = await prisma.partner.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Partner not found' });

    const parsed = partnerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const updated = await prisma.partner.update({ where: { id }, data: parsed.data });
    await logAudit({
      userId: req.session.user.id,
      action: 'UPDATE',
      resource: 'partner',
      resourceId: id,
      details: { before: existing, after: updated },
    });
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    const existing = await prisma.partner.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Partner not found' });

    await prisma.partner.delete({ where: { id } });
    await logAudit({
      userId: req.session.user.id,
      action: 'DELETE',
      resource: 'partner',
      resourceId: id,
      details: { before: existing },
    });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
