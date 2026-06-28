import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withEditor, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';
import { isValidCuid, type ServiceTypeFieldInput } from '@/lib/validation';
import { parseRows, validateServiceRows, duplicateMappingTargets, type ImportFormat } from '@/lib/import';
import type { Prisma } from '@prisma/client';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return void res.status(400).json({ error: 'Invalid request body' });
  }

  const { format, data, mapping, serviceTypeId, dryRun } = req.body as {
    format: ImportFormat;
    data: string;
    mapping: Record<string, string | null>;
    serviceTypeId: string;
    dryRun: boolean;
  };
  if (
    (format !== 'csv' && format !== 'json') ||
    typeof data !== 'string' ||
    typeof mapping !== 'object' || !mapping ||
    typeof dryRun !== 'boolean'
  ) {
    return void res.status(400).json({ error: 'Invalid request body' });
  }
  if (duplicateMappingTargets(mapping).length > 0) {
    return void res.status(400).json({ error: 'Each field can only be mapped once' });
  }
  if (!isValidCuid(serviceTypeId)) {
    return void res.status(400).json({ error: 'A valid serviceTypeId is required' });
  }

  const serviceType = await prisma.serviceType.findUnique({ where: { id: serviceTypeId } });
  if (!serviceType) return void res.status(400).json({ error: 'Service type not found' });

  let parsed;
  try {
    parsed = parseRows(format, data);
  } catch (err) {
    return void res.status(400).json({ error: err instanceof Error ? err.message : 'Could not parse file' });
  }

  const customers = await prisma.customer.findMany({ select: { id: true, clientCode: true, name: true } });
  // Detect names that appear more than once so ambiguous name lookups fail rather than silently picking the wrong customer
  const nameCounts = new Map<string, number>();
  for (const c of customers) {
    const nameKey = c.name.toLowerCase();
    nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
  }
  const duplicateNames = new Set<string>(
    [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name)
  );
  const customerByKey = new Map<string, string>();
  // First pass: clientCode keys take highest priority and must never be overwritten by a name
  for (const c of customers) {
    if (c.clientCode) customerByKey.set(c.clientCode.toLowerCase(), c.id);
  }
  // Second pass: name keys only if the key isn't already claimed by a clientCode (and name is unambiguous)
  for (const c of customers) {
    const nameKey = c.name.toLowerCase();
    if (!duplicateNames.has(nameKey) && !customerByKey.has(nameKey)) {
      customerByKey.set(nameKey, c.id);
    }
  }

  const report = validateServiceRows(parsed.rows, {
    mapping,
    serviceTypeId,
    fieldSchema: (serviceType.fieldSchema as ServiceTypeFieldInput[]) ?? [],
    customerByKey,
  });

  if (dryRun) return void res.status(200).json(report);
  if (!report.canCommit) return void res.status(400).json({ error: 'Cannot commit: file has errors', ...report });

  const payload = report.rows.map((r) => r.data as Prisma.ServiceCreateManyInput);
  try {
    const result = await prisma.$transaction(async (tx) => tx.service.createMany({ data: payload }));
    await logAudit({
      userId: req.session.user.id,
      action: 'IMPORT',
      resource: 'service',
      details: { count: result.count, serviceTypeId },
    });
    logger.info({ count: result.count, serviceTypeId }, 'Services imported');
    return void res.status(200).json({ ...report, committed: result.count });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return void res.status(409).json({ error: 'Data changed since preview; please re-preview and try again' });
    }
    throw err;
  }
}

export default withEditor(handler);
