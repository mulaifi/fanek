import { parseRows, autoMap, CUSTOMER_FIELDS, MAX_IMPORT_ROWS } from '@/lib/import';

describe('parseRows', () => {
  test('parses CSV with header row and quoted commas', () => {
    const csv = 'Name,Client Code\n"Acme, Inc.",AC1\nBeta,BE2\n';
    const { headers, rows } = parseRows('csv', csv);
    expect(headers).toEqual(['Name', 'Client Code']);
    expect(rows).toEqual([
      { Name: 'Acme, Inc.', 'Client Code': 'AC1' },
      { Name: 'Beta', 'Client Code': 'BE2' },
    ]);
  });

  test('strips UTF-8 BOM from first header', () => {
    const csv = '﻿Name,Status\nAcme,Active\n';
    expect(parseRows('csv', csv).headers).toEqual(['Name', 'Status']);
  });

  test('parses a JSON array of objects', () => {
    const json = JSON.stringify([{ Name: 'Acme', Status: 'Active' }, { Name: 'Beta' }]);
    const { headers, rows } = parseRows('json', json);
    expect(headers).toEqual(['Name', 'Status']);
    expect(rows[1]).toEqual({ Name: 'Beta', Status: '' });
  });

  test('parses JSON wrapped in { data: [...] }', () => {
    const json = JSON.stringify({ data: [{ Name: 'Acme' }] });
    expect(parseRows('json', json).rows).toEqual([{ Name: 'Acme' }]);
  });

  test('throws on more than MAX_IMPORT_ROWS rows', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Row${i}`).join('\n');
    expect(() => parseRows('csv', `Name\n${rows}\n`)).toThrow(/too many rows/i);
  });
});

describe('autoMap', () => {
  test('exact-matches our own export headers', () => {
    const m = autoMap(['Name', 'Client Code', 'Status'], CUSTOMER_FIELDS);
    expect(m).toEqual({ Name: 'name', 'Client Code': 'clientCode', Status: 'status' });
  });

  test('fuzzy-matches foreign headers and ignores unknown', () => {
    const m = autoMap(['company', 'account_no', 'Region'], CUSTOMER_FIELDS);
    expect(m['company']).toBe('name');      // alias-normalized to name
    expect(m['Region']).toBeNull();
  });
});
