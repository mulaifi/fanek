import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const type = asQueryString(req.query.type);
  const where: Prisma.PartnerWhereInput = {};
  if (type) where.type = type;

  const partners = await prisma.partner.findMany({ where, orderBy: { name: 'asc' } });
  const csv = stringify(
    partners.map((partner) => ({
      Name: partner.name,
      Type: partner.type,
      Notes: partner.notes || '',
      Created: partner.createdAt.toISOString().split('T')[0],
    })),
    { header: true }
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="partners.csv"');
  return res.send(csv);
}

export default withAuth(handler);
