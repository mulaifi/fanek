import { z } from 'zod';

export const serviceTypeFieldSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-zA-Z0-9_]*$/, 'Must be camelCase identifier'),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'currency', 'boolean']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

export const serviceTypeSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  description: z.string().optional(),
  fieldSchema: z.array(serviceTypeFieldSchema),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const contactSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  emails: z.array(z.object({ value: z.string().email(), category: z.string() })).optional(),
  phones: z.array(z.object({ value: z.string(), category: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1).max(200),
  clientCode: z.string().min(1).max(50).optional().nullable(),
  status: z.string().optional(),
  vertical: z.string().optional(),
  website: z.string().url().optional().nullable(),
  contractNumber: z.string().optional(),
  contractStart: z.string().datetime().optional().nullable(),
  contractEnd: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
  address: z.string().optional().nullable(),
});

export const partnerSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1),
  contacts: z.array(contactSchema).optional(),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  customerId: z.cuid(),
  serviceTypeId: z.cuid(),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
});
