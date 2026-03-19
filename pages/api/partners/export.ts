import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { stringify } from 'csv-stringify/sync';
import { sanitizeCsvValue } from '@/lib/export';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { type } = req.query;
  const where: Record<string, unknown> = {};
  if (type) where.type = Array.isArray(type) ? type[0] : type;

  const partners = await prisma.partner.findMany({ where, orderBy: { name: 'asc' } });
  const csv = stringify(
    partners.map((p) => ({
      Name: sanitizeCsvValue(p.name),
      Type: sanitizeCsvValue(p.type),
      Notes: sanitizeCsvValue(p.notes || ''),
      Created: p.createdAt.toISOString().split('T')[0],
    })),
    { header: true }
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="partners.csv"');
  return res.send(csv);
}

export default withAuth(handler);
