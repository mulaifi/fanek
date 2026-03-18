import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';

import { withAuth, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { serviceSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

function parseFieldSchema(value: Prisma.JsonValue): Array<{ name: string; required: boolean }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((field) => {
      if (typeof field !== 'object' || field === null) return null;
      const record = field as Record<string, unknown>;
      if (typeof record.name !== 'string') return null;
      return {
        name: record.name,
        required: Boolean(record.required),
      };
    })
    .filter((field): field is { name: string; required: boolean } => field !== null);
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { customerId, serviceTypeId, fieldValues } = parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    const serviceType = await prisma.serviceType.findUnique({ where: { id: serviceTypeId } });
    if (!serviceType) {
      return res.status(400).json({ error: 'Service type not found' });
    }

    const parsedSchema = parseFieldSchema(serviceType.fieldSchema);
    if (parsedSchema.length > 0) {
      const requiredFields = parsedSchema.filter((field) => field.required).map((field) => field.name);
      const missingFields = requiredFields.filter((name) => {
        if (!fieldValues || typeof fieldValues !== 'object') return true;
        const value = fieldValues[name];
        return value === undefined || value === null || value === '';
      });
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }
    }

    const createData: Prisma.ServiceUncheckedCreateInput = {
      customerId: parsed.data.customerId,
      serviceTypeId: parsed.data.serviceTypeId,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      notes: parsed.data.notes,
      fieldValues: (parsed.data.fieldValues ?? {}) as Prisma.InputJsonValue,
    };

    const service = await prisma.service.create({ data: createData });
    await logAudit({
      userId: req.session.user.id,
      action: 'CREATE',
      resource: 'service',
      resourceId: service.id,
      details: { after: service },
    });
    logger.info({ serviceId: service.id }, 'Service created');
    return res.status(201).json(service);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
