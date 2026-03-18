import indexHandler from '../../pages/api/partners/index';
import idHandler from '../../pages/api/partners/[id]';
import exportHandler from '../../pages/api/partners/export';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    partner: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    auditLog: { create: jest.fn() },
  },
}));

jest.mock('@/lib/auth/guard', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withAuth: (handler: any) => (req: any, res: any) => {
    req.session = { user: { id: 'u1', role: req._testRole || 'ADMIN' } };
    return handler(req, res);
  },
}));

jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('csv-stringify/sync', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stringify: jest.fn((rows: any[]) => {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map((r) => Object.values(r).join(','));
    return [headers, ...lines].join('\n');
  }),
}));

interface MockReqResOptions {
  method?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  role?: string;
}

function mockReqRes({ method = 'GET', body = {}, query = {}, role }: MockReqResOptions = {}) {
  const req: Record<string, unknown> = { method, body, query };
  if (role) req._testRole = role;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- GET /api/partners ----

describe('GET /api/partners', () => {
  test('returns paginated list with total count', async () => {
    const partners = [
      { id: 'p1', name: 'Acme Partners', type: 'Reseller' },
      { id: 'p2', name: 'Beta Partners', type: 'Vendor' },
    ];
    prisma.partner.findMany.mockResolvedValue(partners);
    prisma.partner.count.mockResolvedValue(2);
    const { req, res } = mockReqRes({ query: { limit: '25' } });
    await indexHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ data: partners, total: 2 });
  });

  test('returns correct total when more results exist than page size', async () => {
    const partners = [
      { id: 'p1', name: 'Acme Partners', type: 'Reseller' },
      { id: 'p2', name: 'Beta Partners', type: 'Vendor' },
    ];
    prisma.partner.findMany.mockResolvedValue(partners);
    prisma.partner.count.mockResolvedValue(5);
    const { req, res } = mockReqRes({ query: { limit: '2', page: '1' } });
    await indexHandler(req, res);
    const call = res.json.mock.calls[0][0];
    expect(call.total).toBe(5);
    expect(call.data).toHaveLength(2);
  });

  test('filters by type when provided', async () => {
    prisma.partner.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { type: 'Reseller' } });
    await indexHandler(req, res);
    expect(prisma.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'Reseller' } })
    );
  });

  test('applies search filter using OR clause', async () => {
    prisma.partner.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { search: 'acme' } });
    await indexHandler(req, res);
    const callArgs = prisma.partner.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR[0].name.contains).toBe('acme');
  });
});

// ---- POST /api/partners ----

describe('POST /api/partners', () => {
  const validBody = {
    name: 'Acme Partners',
    type: 'Reseller',
  };

  test('creates partner with valid data', async () => {
    const created = { id: 'p1', ...validBody };
    prisma.partner.create.mockResolvedValue(created);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
    expect(prisma.partner.create).toHaveBeenCalledWith({ data: validBody });
  });

  test('rejects missing name with 400', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: { type: 'Reseller' } });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toBe('Validation failed');
  });

  test('rejects missing type with 400', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: { name: 'Acme Partners' } });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects VIEWER role with 403', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: validBody, role: 'VIEWER' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 409 on duplicate name (P2002)', async () => {
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    prisma.partner.create.mockRejectedValue(err);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ---- Method not allowed on index ----

describe('index handler - unsupported methods', () => {
  test('returns 405 for DELETE', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ---- GET /api/partners/[id] ----

describe('GET /api/partners/[id]', () => {
  test('returns partner by id', async () => {
    const partner = { id: 'p1', name: 'Acme Partners', type: 'Reseller' };
    prisma.partner.findUnique.mockResolvedValue(partner);
    const { req, res } = mockReqRes({ query: { id: 'p1' } });
    await idHandler(req, res);
    expect(res.json).toHaveBeenCalledWith(partner);
  });

  test('returns 404 when partner not found', async () => {
    prisma.partner.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { id: 'missing' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- PUT /api/partners/[id] ----

describe('PUT /api/partners/[id]', () => {
  test('updates partner and logs audit', async () => {
    const existing = { id: 'p1', name: 'Old Name', type: 'Reseller' };
    const updated = { ...existing, name: 'New Name' };
    prisma.partner.findUnique.mockResolvedValue(existing);
    prisma.partner.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New Name' },
      query: { id: 'p1' },
    });
    await idHandler(req, res);
    expect(prisma.partner.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { name: 'New Name' } });
    expect(res.json).toHaveBeenCalledWith(updated);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resource: 'partner', resourceId: 'p1' })
    );
  });

  test('returns 403 for VIEWER role', async () => {
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New' },
      query: { id: 'p1' },
      role: 'VIEWER',
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if partner does not exist', async () => {
    prisma.partner.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New' },
      query: { id: 'missing' },
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- DELETE /api/partners/[id] ----

describe('DELETE /api/partners/[id]', () => {
  test('deletes partner when ADMIN and logs audit', async () => {
    const existing = { id: 'p1', name: 'Acme Partners', type: 'Reseller' };
    prisma.partner.findUnique.mockResolvedValue(existing);
    prisma.partner.delete.mockResolvedValue({});
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'p1' } });
    await idHandler(req, res);
    expect(prisma.partner.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', resource: 'partner', resourceId: 'p1' })
    );
  });

  test('returns 403 for EDITOR role', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'p1' }, role: 'EDITOR' });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if partner does not exist', async () => {
    prisma.partner.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'missing' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.partner.delete).not.toHaveBeenCalled();
  });
});

// ---- GET /api/partners/export ----

describe('GET /api/partners/export', () => {
  test('returns CSV with correct columns', async () => {
    const partners = [
      { id: 'p1', name: 'Acme Partners', type: 'Reseller', notes: 'Top partner', createdAt: new Date('2025-01-15') },
    ];
    prisma.partner.findMany.mockResolvedValue(partners);
    const { req, res } = mockReqRes({ query: {} });
    await exportHandler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="partners.csv"');
    expect(res.send).toHaveBeenCalled();
    const csvContent = res.send.mock.calls[0][0];
    expect(csvContent).toContain('Name');
    expect(csvContent).toContain('Type');
    expect(csvContent).toContain('Notes');
    expect(csvContent).toContain('Created');
  });

  test('filters by type when provided', async () => {
    prisma.partner.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { type: 'Reseller' } });
    await exportHandler(req, res);
    expect(prisma.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'Reseller' } })
    );
  });

  test('returns 405 for non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await exportHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
