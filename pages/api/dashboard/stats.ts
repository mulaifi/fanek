import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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

  const serviceTypeIds = servicesByType.map((service) => service.serviceTypeId);
  const serviceTypes = await prisma.serviceType.findMany({
    where: { id: { in: serviceTypeIds } },
    select: { id: true, name: true, icon: true },
  });
  const typeMap = Object.fromEntries(serviceTypes.map((serviceType) => [serviceType.id, serviceType]));

  return res.json({
    totalCustomers,
    totalServices,
    totalPartners,
    customersByStatus: customersByStatus.map((customerStatus) => ({
      status: customerStatus.status,
      count: customerStatus._count.status,
    })),
    servicesByType: servicesByType.map((serviceType) => ({
      serviceTypeId: serviceType.serviceTypeId,
      name: typeMap[serviceType.serviceTypeId]?.name || 'Unknown',
      icon: typeMap[serviceType.serviceTypeId]?.icon || null,
      count: serviceType._count.serviceTypeId,
    })),
    recentCustomers,
  });
}

export default withAuth(handler);
