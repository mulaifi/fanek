import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  firstLogin: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const [customers, partners, serviceTypes, users] = await Promise.all([
    prisma.customer.findMany({
      include: {
        services: { include: { serviceType: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.partner.findMany({ orderBy: { name: 'asc' } }),
    prisma.serviceType.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: 'desc' } }),
  ]);

  logger.info(
    { customersCount: customers.length, partnersCount: partners.length, usersCount: users.length },
    'Full data export performed'
  );

  res.json({
    exportedAt: new Date().toISOString(),
    customers,
    partners,
    serviceTypes,
    users,
  });
}

export default withAdmin(handler);
