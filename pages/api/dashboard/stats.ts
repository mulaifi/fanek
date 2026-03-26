import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const [
    totalCustomers,
    totalServices,
    totalPartners,
    customersByStatus,
    servicesByType,
    recentCustomers,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.service.count(),
    prisma.partner.count(),
    prisma.customer.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.service.groupBy({ by: ['serviceTypeId'], _count: { serviceTypeId: true } }),
    prisma.customer.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, clientCode: true, status: true, updatedAt: true },
    }),
  ]);

  // Enrich servicesByType with service type names
  const serviceTypeIds = servicesByType.map(s => s.serviceTypeId);
  const serviceTypes = await prisma.serviceType.findMany({
    where: { id: { in: serviceTypeIds } },
    select: { id: true, name: true, icon: true },
  });
  const typeMap = Object.fromEntries(serviceTypes.map(t => [t.id, t]));

  res.json({
    totalCustomers,
    totalServices,
    totalPartners,
    customersByStatus: customersByStatus.map(s => ({ status: s.status, count: s._count.status })),
    servicesByType: servicesByType.map(s => ({
      serviceTypeId: s.serviceTypeId,
      name: typeMap[s.serviceTypeId]?.name ?? 'Unknown',
      icon: typeMap[s.serviceTypeId]?.icon ?? null,
      count: s._count.serviceTypeId,
    })),
    recentCustomers,
  });
}

export default withAuth(handler);
