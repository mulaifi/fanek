import { parse } from 'csv-parse/sync';

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
