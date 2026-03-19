import { stringify } from 'csv-stringify/sync';

/**
 * Sanitize a value for CSV export to prevent formula injection.
 * Values starting with =, +, -, @, \t, or \r could be interpreted
 * as formulas when opened in spreadsheet applications.
 */
export function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Sanitize all string values in a record for CSV export.
 */
export function sanitizeCsvRecord(record: Record<string, unknown>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    sanitized[key] = sanitizeCsvValue(value);
  }
  return sanitized;
}

export function toCsv(data: Record<string, unknown>[], columns: string[]): string {
  return stringify(data.map(sanitizeCsvRecord), { header: true, columns }) as string;
}

export function toJsonExport(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
