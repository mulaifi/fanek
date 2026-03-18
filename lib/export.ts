import { stringify } from 'csv-stringify/sync';

export function toCsv<T extends Record<string, unknown>>(data: T[], columns: string[]): string {
  return stringify(data, { header: true, columns });
}

export function toJsonExport<T>(data: T): string {
  return JSON.stringify(data, null, 2);
}
