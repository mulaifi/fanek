import type { NextApiResponse } from 'next';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = asQueryString(req.query.q);
  if (!q || q.trim().length === 0) {
    return res.json({ customers: [], partners: [], services: [] });
  }
  const search = q.trim();

  const [customers, partners, services] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { clientCode: { contains: search, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: { id: true, name: true, clientCode: true, status: true },
    }),
    prisma.partner.findMany({
      where: { name: { contains: search, mode: 'insensitive' } },
      take: 10,
      select: { id: true, name: true, type: true },
    }),
    prisma.service.findMany({
      where: { notes: { contains: search, mode: 'insensitive' } },
      take: 10,
      include: {
        serviceType: { select: { name: true } },
        customer: { select: { name: true, id: true } },
      },
    }),
  ]);

  return res.json({ customers, partners, services });
}

export default withAuth(handler);
