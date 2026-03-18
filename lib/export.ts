import { stringify } from 'csv-stringify/sync';

export function toCsv(data: Record<string, unknown>[], columns: string[]): string {
  return stringify(data, { header: true, columns }) as string;
}

export function toJsonExport(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
