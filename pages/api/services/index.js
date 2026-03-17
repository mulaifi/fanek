import { withAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { serviceSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

async function handler(req, res) {
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

    // Validate fieldValues against the service type's fieldSchema
    if (serviceType.fieldSchema && serviceType.fieldSchema.length > 0) {
      const requiredFields = serviceType.fieldSchema.filter((f) => f.required).map((f) => f.name);
      const missingFields = requiredFields.filter(
        (name) => !fieldValues || fieldValues[name] === undefined || fieldValues[name] === null || fieldValues[name] === ''
      );
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }
    }

    const service = await prisma.service.create({ data: parsed.data });
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
