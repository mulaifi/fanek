import { parse } from 'csv-parse/sync';
import { customerSchema } from '@/lib/validation';
import type { ServiceTypeFieldInput } from '@/lib/validation';

export type ImportFormat = 'csv' | 'json';
export type RowStatus = 'valid' | 'error' | 'duplicate';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

export interface RowReport {
  index: number;
  status: RowStatus;
  errors: string[];
  data?: Record<string, unknown>;
}

export interface ImportReport {
  totalRows: number;
  validCount: number;
  errorCount: number;
  canCommit: boolean;
  rows: RowReport[];
}

export interface FieldTarget {
  field: string;
  label: string;
  required?: boolean;
}

export const MAX_IMPORT_ROWS = 2000;

export const CUSTOMER_FIELDS: FieldTarget[] = [
  { field: 'name', label: 'Name', required: true },
  { field: 'clientCode', label: 'Client Code' },
  { field: 'status', label: 'Status' },
  { field: 'vertical', label: 'Vertical' },
  { field: 'website', label: 'Website' },
  { field: 'contractNumber', label: 'Contract Number' },
  { field: 'contractStart', label: 'Contract Start' },
  { field: 'contractEnd', label: 'Contract End' },
  { field: 'notes', label: 'Notes' },
  { field: 'address', label: 'Address' },
];

/** Common foreign-header aliases → canonical field. Keys are normalized (see `normalizeHeader`). */
const FIELD_ALIASES: Record<string, string> = {
  company: 'name',
  companyname: 'name',
  customer: 'name',
  account: 'name',
  code: 'clientCode',
  accountno: 'clientCode',
  accountnumber: 'clientCode',
  industry: 'vertical',
  sector: 'vertical',
  url: 'website',
  web: 'website',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseRows(format: ImportFormat, data: string): ParsedFile {
  let headers: string[];
  let rows: Record<string, string>[];

  if (format === 'csv') {
    const records = parse(data, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
    headers = records.length > 0 ? Object.keys(records[0]) : [];
    rows = records;
  } else {
    const parsed = JSON.parse(data);
    const arr: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : [];
    const headerSet = new Set<string>();
    for (const obj of arr) Object.keys(obj).forEach((k) => headerSet.add(k));
    headers = [...headerSet];
    rows = arr.map((obj) => {
      const row: Record<string, string> = {};
      for (const h of headers) {
        const v = (obj as Record<string, unknown>)[h];
        row[h] = v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
      return row;
    });
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Too many rows: ${rows.length} (max ${MAX_IMPORT_ROWS})`);
  }
  return { headers, rows };
}

export function autoMap(headers: string[], targets: FieldTarget[]): Record<string, string | null> {
  const byNorm = new Map<string, string>();
  for (const t of targets) {
    byNorm.set(normalizeHeader(t.field), t.field);
    byNorm.set(normalizeHeader(t.label), t.field);
  }
  const mapping: Record<string, string | null> = {};
  for (const h of headers) {
    const n = normalizeHeader(h);
    mapping[h] = byNorm.get(n) ?? FIELD_ALIASES[n] ?? null;
  }
  return mapping;
}

const DATE_FIELDS = new Set(['contractStart', 'contractEnd']);

export function coerceDate(value: string): string | null {
  const v = value?.trim();
  if (!v) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function buildCandidate(
  row: Record<string, string>,
  mapping: Record<string, string | null>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [col, field] of Object.entries(mapping)) {
    if (!field) continue;
    const raw = (row[col] ?? '').trim();
    if (DATE_FIELDS.has(field)) {
      out[field] = raw === '' ? undefined : (coerceDate(raw) ?? `__INVALID_DATE__:${raw}`);
    } else {
      out[field] = raw === '' ? undefined : raw;
    }
  }
  return out;
}

export interface CustomerValidationContext {
  mapping: Record<string, string | null>;
  allowedStatuses: string[];
  existingClientCodes: Set<string>;
  existingNames: Set<string>;
}

export function validateCustomerRows(
  rows: Record<string, string>[],
  ctx: CustomerValidationContext
): ImportReport {
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();
  const reports: RowReport[] = rows.map((row, index) => {
    const candidate = buildCandidate(row, ctx.mapping);
    const errors: string[] = [];

    // Invalid-date sentinel surfaced from buildCandidate
    for (const [field, val] of Object.entries(candidate)) {
      if (typeof val === 'string' && val.startsWith('__INVALID_DATE__:')) {
        errors.push(`${field}: invalid date "${val.split(':').slice(1).join(':')}"`);
        delete candidate[field];
      }
    }

    const parsed = customerSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      for (const [field, msgs] of Object.entries(fieldErrors)) {
        if (msgs && msgs.length) errors.push(`${field}: ${msgs[0]}`);
      }
    }

    const data = parsed.success ? parsed.data : candidate;
    const status = typeof data.status === 'string' ? data.status : undefined;
    if (status && !ctx.allowedStatuses.includes(status)) {
      errors.push(`status: must be one of ${ctx.allowedStatuses.join(', ')}`);
    }

    if (errors.length > 0) {
      return { index, status: 'error', errors, data: data as Record<string, unknown> };
    }

    // Duplicate detection (only once the row is otherwise valid)
    const code = typeof data.clientCode === 'string' ? data.clientCode : '';
    const nameKey = typeof data.name === 'string' ? data.name.toLowerCase() : '';
    if (code) {
      if (ctx.existingClientCodes.has(code) || seenCodes.has(code)) {
        return { index, status: 'duplicate', errors: [`clientCode "${code}" already exists`], data: data as Record<string, unknown> };
      }
      seenCodes.add(code);
    } else if (nameKey && (ctx.existingNames.has(nameKey) || seenNames.has(nameKey))) {
      return { index, status: 'duplicate', errors: [`name "${data.name}" already exists`], data: data as Record<string, unknown> };
    }
    if (nameKey) seenNames.add(nameKey);

    return { index, status: 'valid', errors: [], data: data as Record<string, unknown> };
  });

  const errorCount = reports.filter((r) => r.status !== 'valid').length;
  return {
    totalRows: reports.length,
    validCount: reports.length - errorCount,
    errorCount,
    canCommit: errorCount === 0 && reports.length > 0,
    rows: reports,
  };
}

export const SERVICE_BASE_FIELDS: FieldTarget[] = [
  { field: 'customerRef', label: 'Customer', required: true },
  { field: 'startDate', label: 'Start Date' },
  { field: 'endDate', label: 'End Date' },
  { field: 'notes', label: 'Notes' },
];

export function serviceFieldTargets(fieldSchema: ServiceTypeFieldInput[]): FieldTarget[] {
  return [
    ...SERVICE_BASE_FIELDS,
    ...fieldSchema.map((f) => ({ field: f.name, label: f.label, required: f.required })),
  ];
}

export interface ServiceValidationContext {
  mapping: Record<string, string | null>;
  serviceTypeId: string;
  fieldSchema: ServiceTypeFieldInput[];
  /** key = clientCode.toLowerCase() AND name.toLowerCase() → customerId */
  customerByKey: Map<string, string>;
}

function coerceFieldValue(raw: string, type: string): { value: unknown } | { error: string } {
  if (type === 'number' || type === 'currency') {
    const n = Number(raw);
    return Number.isNaN(n) ? { error: 'not a number' } : { value: n };
  }
  if (type === 'boolean') {
    const low = raw.toLowerCase();
    if (['true', 'yes', '1'].includes(low)) return { value: true };
    if (['false', 'no', '0'].includes(low)) return { value: false };
    return { error: 'not a boolean' };
  }
  if (type === 'date') {
    const iso = coerceDate(raw);
    return iso ? { value: iso } : { error: 'invalid date' };
  }
  return { value: raw };
}

export function validateServiceRows(
  rows: Record<string, string>[],
  ctx: ServiceValidationContext
): ImportReport {
  const reports: RowReport[] = rows.map((row, index) => {
    const candidate = buildCandidate(row, ctx.mapping);
    const errors: string[] = [];

    // Resolve customer
    const ref = typeof candidate.customerRef === 'string' ? candidate.customerRef.toLowerCase() : '';
    const customerId = ref ? ctx.customerByKey.get(ref) : undefined;
    if (!customerId) errors.push(`customer: "${candidate.customerRef ?? ''}" not found`);

    // Dynamic fields
    const fieldValues: Record<string, unknown> = {};
    for (const f of ctx.fieldSchema) {
      const rawVal = candidate[f.name];
      const present = rawVal !== undefined && rawVal !== '';
      if (!present) {
        if (f.required) errors.push(`${f.name}: required`);
        continue;
      }
      const coerced = coerceFieldValue(String(rawVal), f.type);
      if ('error' in coerced) {
        errors.push(`${f.name}: ${coerced.error}`);
        continue;
      }
      if (f.type === 'select' && f.options && !f.options.includes(String(coerced.value))) {
        errors.push(`${f.name}: must be one of ${f.options.join(', ')}`);
        continue;
      }
      fieldValues[f.name] = coerced.value;
    }

    // Optional base dates
    let startDate: string | null = null;
    if (typeof candidate.startDate === 'string' && candidate.startDate !== '') {
      startDate = coerceDate(candidate.startDate);
      if (!startDate) errors.push('startDate: invalid date');
    }
    let endDate: string | null = null;
    if (typeof candidate.endDate === 'string' && candidate.endDate !== '') {
      endDate = coerceDate(candidate.endDate);
      if (!endDate) errors.push('endDate: invalid date');
    }

    if (errors.length > 0) return { index, status: 'error', errors };

    const data: Record<string, unknown> = {
      customerId,
      serviceTypeId: ctx.serviceTypeId,
      fieldValues,
    };
    if (startDate) data.startDate = startDate;
    if (endDate) data.endDate = endDate;
    if (candidate.notes) data.notes = candidate.notes;

    return { index, status: 'valid', errors: [], data };
  });

  const errorCount = reports.filter((r) => r.status !== 'valid').length;
  return {
    totalRows: reports.length,
    validCount: reports.length - errorCount,
    errorCount,
    canCommit: errorCount === 0 && reports.length > 0,
    rows: reports,
  };
}
