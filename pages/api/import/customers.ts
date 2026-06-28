import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withEditor, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';
import { parseRows, validateCustomerRows, type ImportFormat } from '@/lib/import';
import type { Prisma } from '@prisma/client';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const { format, data, mapping, dryRun } = req.body as {
    format: ImportFormat;
    data: string;
    mapping: Record<string, string | null>;
    dryRun: boolean;
  };
  if ((format !== 'csv' && format !== 'json') || typeof data !== 'string' || typeof mapping !== 'object' || !mapping) {
    return void res.status(400).json({ error: 'Invalid request body' });
  }

  let parsed;
  try {
    parsed = parseRows(format, data);
  } catch (err) {
    return void res.status(400).json({ error: err instanceof Error ? err.message : 'Could not parse file' });
  }

  const settings = await getSettings();
  const allowedStatuses = (settings?.customerStatuses as string[]) ?? [];
  const existing = await prisma.customer.findMany({ select: { clientCode: true, name: true } });
  const existingClientCodes = new Set(existing.map((c) => c.clientCode).filter((c): c is string => !!c));
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

  const report = validateCustomerRows(parsed.rows, { mapping, allowedStatuses, existingClientCodes, existingNames });

  if (dryRun) return void res.status(200).json(report);

  if (!report.canCommit) {
    return void res.status(400).json({ error: 'Cannot commit: file has errors', ...report });
  }

  const payload = report.rows.map((r) => r.data as Prisma.CustomerCreateManyInput);
  try {
    const result = await prisma.$transaction(async (tx) => tx.customer.createMany({ data: payload }));
    await logAudit({
      userId: req.session.user.id,
      action: 'IMPORT',
      resource: 'customer',
      details: { count: result.count },
    });
    logger.info({ count: result.count }, 'Customers imported');
    return void res.status(200).json({ ...report, committed: result.count });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return void res.status(409).json({ error: 'Data changed since preview; please re-preview and try again' });
    }
    throw err;
  }
}

export default withEditor(handler);
