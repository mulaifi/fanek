import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { toCsv } from '@/lib/export';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }
  const { type } = req.query;
  const where: Record<string, unknown> = {};
  if (type) where.type = Array.isArray(type) ? type[0] : type;

  const partners = await prisma.partner.findMany({ where, orderBy: { name: 'asc' } });
  const csv = toCsv(
    partners.map((p) => ({
      Name: p.name,
      Type: p.type,
      Notes: p.notes || '',
      Created: p.createdAt.toISOString().split('T')[0],
    })),
    ['Name', 'Type', 'Notes', 'Created']
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="partners.csv"');
  return res.send(csv);
}

export default withAuth(handler);
