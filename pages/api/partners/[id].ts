import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { partnerSchema, isValidCuid } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const id = req.query.id as string;
  if (!isValidCuid(id)) {
    return res.status(400).json({ error: 'Invalid partner ID format' });
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

  return methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
}

export default withAuth(handler);
