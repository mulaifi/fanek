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
  const { status } = req.query;
  const where: Record<string, unknown> = {};
  if (status) where.status = Array.isArray(status) ? status[0] : status;

  const customers = await prisma.customer.findMany({ where, orderBy: { name: 'asc' } });
  const csv = stringify(
    customers.map((c) => ({
      Name: sanitizeCsvValue(c.name),
      'Client Code': sanitizeCsvValue(c.clientCode),
      Status: sanitizeCsvValue(c.status),
      Vertical: sanitizeCsvValue(c.vertical || ''),
      'Contract Number': sanitizeCsvValue(c.contractNumber || ''),
      'Contract Start': c.contractStart ? c.contractStart.toISOString().split('T')[0] : '',
      'Contract End': c.contractEnd ? c.contractEnd.toISOString().split('T')[0] : '',
      Created: c.createdAt.toISOString().split('T')[0],
    })),
    { header: true }
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
  return res.send(csv);
}

export default withAuth(handler);
