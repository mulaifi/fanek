import { z } from 'zod';

export const serviceTypeFieldSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-zA-Z0-9_]*$/, 'Must be camelCase identifier'),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'currency', 'boolean']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  currencySymbol: z.string().max(5).optional(),
});

export const serviceTypeSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  description: z.string().optional(),
  fieldSchema: z.array(serviceTypeFieldSchema),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  title: z.string().optional(),
  emails: z.array(z.object({ value: z.string().email(), category: z.string() })).optional(),
  phones: z.array(z.object({ value: z.string(), category: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
});

/** Preprocess: convert empty strings and null to undefined so optional validators pass cleanly */
function emptyToUndef(val: unknown): unknown {
  if (val === '' || val === null) return undefined;
  return val;
}

export const customerSchema = z.object({
  name: z.string().min(1).max(200),
  clientCode: z.preprocess(emptyToUndef, z.string().min(1).max(50).optional()),
  status: z.preprocess(emptyToUndef, z.string().optional()),
  vertical: z.preprocess(emptyToUndef, z.string().optional()),
  website: z.preprocess(emptyToUndef, z.string().url().optional()),
  contractNumber: z.preprocess(emptyToUndef, z.string().optional()),
  contractStart: z.preprocess(emptyToUndef, z.string().datetime().optional()),
  contractEnd: z.preprocess(emptyToUndef, z.string().datetime().optional()),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
  contacts: z.array(contactSchema).optional(),
  address: z.preprocess(emptyToUndef, z.string().optional()),
});

export const partnerSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.preprocess(emptyToUndef, z.string().optional()),
  contacts: z.array(contactSchema).optional(),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
});

export const serviceSchema = z.object({
  customerId: z.cuid(),
  serviceTypeId: z.cuid(),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
});

export type ServiceTypeFieldInput = z.infer<typeof serviceTypeFieldSchema>;
export type ServiceTypeInput = z.infer<typeof serviceTypeSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type PartnerInput = z.infer<typeof partnerSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;

/**
 * Extract a user-friendly error message from an API error response.
 * If the response includes field-level validation details, formats them as a readable list.
 * Otherwise falls back to the generic error message.
 */
export function formatApiError(data: { error?: string; details?: { fieldErrors?: Record<string, string[]> } }, fallback: string): string {
  if (data.details?.fieldErrors) {
    const fieldErrors = data.details.fieldErrors;
    const messages = Object.entries(fieldErrors)
      .filter(([, errors]) => errors.length > 0)
      .map(([field, errors]) => `${field}: ${errors[0]}`);
    if (messages.length > 0) return messages.join(', ');
  }
  return data.error || fallback;
}

/** CUID format: starts with 'c' followed by lowercase alphanumeric characters */
const CUID_REGEX = /^c[a-z0-9]{20,}$/;

/** Validate that a string is a valid CUID. Returns true if valid. */
export function isValidCuid(value: unknown): value is string {
  return typeof value === 'string' && CUID_REGEX.test(value);
}
