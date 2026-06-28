import { parseRows, autoMap, CUSTOMER_FIELDS, MAX_IMPORT_ROWS, validateCustomerRows, coerceDate } from '@/lib/import';

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

const baseCtx = {
  mapping: { Name: 'name', 'Client Code': 'clientCode', Status: 'status', Start: 'contractStart' },
  allowedStatuses: ['Active', 'Inactive'],
  existingClientCodes: new Set<string>(),
  existingNames: new Set<string>(),
};

describe('coerceDate', () => {
  test('normalizes YYYY-MM-DD to ISO datetime', () => {
    expect(coerceDate('2026-01-15')).toBe('2026-01-15T00:00:00.000Z');
  });
  test('returns null for empty or garbage', () => {
    expect(coerceDate('')).toBeNull();
    expect(coerceDate('not-a-date')).toBeNull();
  });
});

describe('validateCustomerRows', () => {
  test('marks a clean row valid and coerces the date', () => {
    const r = validateCustomerRows(
      [{ Name: 'Acme', 'Client Code': 'AC1', Status: 'Active', Start: '2026-01-15' }],
      baseCtx
    );
    expect(r.canCommit).toBe(true);
    expect(r.rows[0].status).toBe('valid');
    expect(r.rows[0].data).toMatchObject({ name: 'Acme', clientCode: 'AC1', contractStart: '2026-01-15T00:00:00.000Z' });
  });

  test('errors on missing required name', () => {
    const r = validateCustomerRows([{ Name: '', 'Client Code': 'AC1', Status: 'Active' }], baseCtx);
    expect(r.canCommit).toBe(false);
    expect(r.rows[0].status).toBe('error');
    expect(r.rows[0].errors.join(' ')).toMatch(/name/i);
  });

  test('errors on status not in allowed list', () => {
    const r = validateCustomerRows([{ Name: 'Acme', 'Client Code': 'AC1', Status: 'Bogus' }], baseCtx);
    expect(r.rows[0].errors.join(' ')).toMatch(/status/i);
  });

  test('flags duplicate clientCode against the DB set', () => {
    const ctx = { ...baseCtx, existingClientCodes: new Set(['AC1']) };
    const r = validateCustomerRows([{ Name: 'Acme', 'Client Code': 'AC1', Status: 'Active' }], ctx);
    expect(r.rows[0].status).toBe('duplicate');
  });

  test('flags duplicate clientCode appearing twice in the file', () => {
    const r = validateCustomerRows(
      [
        { Name: 'Acme', 'Client Code': 'AC1', Status: 'Active' },
        { Name: 'Acme2', 'Client Code': 'AC1', Status: 'Active' },
      ],
      baseCtx
    );
    expect(r.rows[1].status).toBe('duplicate');
  });

  test('flags name collision when row has no clientCode', () => {
    const ctx = { ...baseCtx, existingNames: new Set(['acme']) };
    const r = validateCustomerRows([{ Name: 'Acme', 'Client Code': '', Status: 'Active' }], ctx);
    expect(r.rows[0].status).toBe('duplicate');
  });
});

import { validateServiceRows, serviceFieldTargets } from '@/lib/import';

const fieldSchema = [
  { name: 'bandwidth', label: 'Bandwidth', type: 'number', required: true },
  { name: 'tier', label: 'Tier', type: 'select', required: false, options: ['Gold', 'Silver'] },
];

const svcCtx = {
  mapping: { Customer: 'customerRef', Bandwidth: 'bandwidth', Tier: 'tier', Notes: 'notes' },
  serviceTypeId: 'ctype00000000000000000001',
  fieldSchema,
  customerByKey: new Map([['ac1', 'ccust0000000000000000001'], ['acme', 'ccust0000000000000000001']]),
};

describe('serviceFieldTargets', () => {
  test('produces base fields plus one target per schema field', () => {
    const t = serviceFieldTargets(fieldSchema).map((f) => f.field);
    expect(t).toEqual(expect.arrayContaining(['customerRef', 'startDate', 'endDate', 'notes', 'bandwidth', 'tier']));
  });
});

describe('validateServiceRows', () => {
  test('resolves customer, coerces number, marks valid', () => {
    const r = validateServiceRows([{ Customer: 'AC1', Bandwidth: '100', Tier: 'Gold', Notes: 'x' }], svcCtx);
    expect(r.canCommit).toBe(true);
    expect(r.rows[0].data).toMatchObject({
      customerId: 'ccust0000000000000000001',
      serviceTypeId: 'ctype00000000000000000001',
      fieldValues: { bandwidth: 100, tier: 'Gold' },
      notes: 'x',
    });
  });

  test('errors when customer cannot be resolved', () => {
    const r = validateServiceRows([{ Customer: 'Nope', Bandwidth: '100' }], svcCtx);
    expect(r.rows[0].status).toBe('error');
    expect(r.rows[0].errors.join(' ')).toMatch(/customer/i);
  });

  test('errors on missing required dynamic field', () => {
    const r = validateServiceRows([{ Customer: 'AC1', Bandwidth: '', Tier: 'Gold' }], svcCtx);
    expect(r.rows[0].errors.join(' ')).toMatch(/bandwidth/i);
  });

  test('errors on select value not in options', () => {
    const r = validateServiceRows([{ Customer: 'AC1', Bandwidth: '100', Tier: 'Bronze' }], svcCtx);
    expect(r.rows[0].errors.join(' ')).toMatch(/tier/i);
  });
});
