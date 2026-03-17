import { stringify } from 'csv-stringify/sync';

export function toCsv(data, columns) {
  return stringify(data, { header: true, columns });
}

export function toJsonExport(data) {
  return JSON.stringify(data, null, 2);
}
