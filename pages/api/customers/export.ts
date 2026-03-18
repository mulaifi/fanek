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
  const status = asQueryString(req.query.status);
  const where: Prisma.CustomerWhereInput = {};
  if (status) where.status = status;

  const customers = await prisma.customer.findMany({ where, orderBy: { name: 'asc' } });
  const csv = stringify(
    customers.map((customer) => ({
      Name: customer.name,
      'Client Code': customer.clientCode,
      Status: customer.status,
      Vertical: customer.vertical || '',
      'Contract Number': customer.contractNumber || '',
      'Contract Start': customer.contractStart ? customer.contractStart.toISOString().split('T')[0] : '',
      'Contract End': customer.contractEnd ? customer.contractEnd.toISOString().split('T')[0] : '',
      Created: customer.createdAt.toISOString().split('T')[0],
    })),
    { header: true }
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
  return res.send(csv);
}

export default withAuth(handler);
