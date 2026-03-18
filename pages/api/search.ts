import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { q } = req.query as { q?: string };
  if (!q || q.trim().length === 0) {
    res.json({ customers: [], partners: [], services: [] });
    return;
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

  res.json({ customers, partners, services });
}

export default withAuth(handler);
