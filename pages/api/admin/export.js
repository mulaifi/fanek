import { withAdmin } from '@/lib/auth/guard';
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
};

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  return res.json({
    exportedAt: new Date().toISOString(),
    customers,
    partners,
    serviceTypes,
    users,
  });
}

export default withAdmin(handler);
