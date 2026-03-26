import indexHandler from '../../pages/api/customers/index';
import idHandler from '../../pages/api/customers/[id]';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    customer: {
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
  methodNotAllowed: (res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (b: unknown) => void } }, allowed: string[]) => { res.setHeader('Allow', allowed.join(', ')); res.status(405).json({ error: 'Method not allowed' }); },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withAuth: (handler: any) => (req: any, res: any) => {
    req.session = { user: { id: 'u1', role: req._testRole || 'ADMIN' } };
    return handler(req, res);
  },
}));

jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn().mockResolvedValue({ customerStatuses: ['Active', 'Suspended'] }),
}));

jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
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

// ---- GET /api/customers ----

describe('GET /api/customers', () => {
  test('returns paginated list with total count', async () => {
    const customers = [
      { id: 'clxxxxxxxxxxxxxxxxcust0001', name: 'Acme', clientCode: 'AC01', _count: { services: 2 } },
      { id: 'clxxxxxxxxxxxxxxxxcust0002', name: 'Beta', clientCode: 'BT01', _count: { services: 0 } },
    ];
    prisma.customer.findMany.mockResolvedValue(customers);
    prisma.customer.count.mockResolvedValue(2);
    const { req, res } = mockReqRes({ query: { limit: '25' } });
    await indexHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ data: customers, total: 2 });
  });

  test('returns correct total when more results exist than page size', async () => {
    const customers = [
      { id: 'clxxxxxxxxxxxxxxxxcust0001', name: 'Acme', clientCode: 'AC01', _count: { services: 0 } },
      { id: 'clxxxxxxxxxxxxxxxxcust0002', name: 'Beta', clientCode: 'BT01', _count: { services: 0 } },
    ];
    prisma.customer.findMany.mockResolvedValue(customers);
    prisma.customer.count.mockResolvedValue(5);
    const { req, res } = mockReqRes({ query: { limit: '2', page: '1' } });
    await indexHandler(req, res);
    const call = res.json.mock.calls[0][0];
    expect(call.total).toBe(5);
    expect(call.data).toHaveLength(2);
  });

  test('filters by status when provided', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { status: 'Active' } });
    await indexHandler(req, res);
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'Active' } })
    );
  });

  test('applies search filter using OR clause', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { search: 'acme' } });
    await indexHandler(req, res);
    const callArgs = prisma.customer.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR[0].name.contains).toBe('acme');
  });
});

// ---- POST /api/customers ----

describe('POST /api/customers', () => {
  const validBody = {
    name: 'Acme Corp',
    clientCode: 'ACME01',
    status: 'Active',
  };

  test('creates customer with valid data', async () => {
    const created = { id: 'clxxxxxxxxxxxxxxxxcust0001', ...validBody };
    prisma.customer.create.mockResolvedValue(created);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
    expect(prisma.customer.create).toHaveBeenCalledWith({ data: validBody });
  });

  test('rejects missing name with 400', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: { clientCode: 'ACME01' } });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toBe('Validation failed');
  });

  test('accepts missing clientCode (optional field)', async () => {
    prisma.customer.create.mockResolvedValue({ id: 'clxxxxxxxxxxxxxxxxcust0002', name: 'Acme Corp', clientCode: null, status: 'Active' });
    const { req, res } = mockReqRes({ method: 'POST', body: { name: 'Acme Corp' } });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rejects VIEWER role with 403', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: validBody, role: 'VIEWER' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects invalid status with 400', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { name: 'Acme Corp', clientCode: 'ACME01', status: 'Bogus' },
    });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toMatch(/Invalid status/);
  });

  test('returns 409 on duplicate clientCode (P2002)', async () => {
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    prisma.customer.create.mockRejectedValue(err);
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

// ---- GET /api/customers/[id] ----

describe('GET /api/customers/[id]', () => {
  test('returns customer with services', async () => {
    const customer = { id: 'clxxxxxxxxxxxxxxxxcust0001', name: 'Acme', services: [] };
    prisma.customer.findUnique.mockResolvedValue(customer);
    const { req, res } = mockReqRes({ query: { id: 'clxxxxxxxxxxxxxxxxcust0001' } });
    await idHandler(req, res);
    expect(res.json).toHaveBeenCalledWith(customer);
  });

  test('returns 404 when customer not found', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { id: 'clxxxxxxxxxxxxxxxxmiss0001' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- PUT /api/customers/[id] ----

describe('PUT /api/customers/[id]', () => {
  test('updates customer and logs audit', async () => {
    const existing = { id: 'clxxxxxxxxxxxxxxxxcust0001', name: 'Old Name', clientCode: 'OLD01', status: 'Active' };
    const updated = { ...existing, name: 'New Name' };
    prisma.customer.findUnique.mockResolvedValue(existing);
    prisma.customer.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New Name' },
      query: { id: 'clxxxxxxxxxxxxxxxxcust0001' },
    });
    await idHandler(req, res);
    expect(prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'clxxxxxxxxxxxxxxxxcust0001' }, data: { name: 'New Name' } });
    expect(res.json).toHaveBeenCalledWith(updated);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resource: 'customer', resourceId: 'clxxxxxxxxxxxxxxxxcust0001' })
    );
  });

  test('returns 403 for VIEWER role', async () => {
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New' },
      query: { id: 'clxxxxxxxxxxxxxxxxcust0001' },
      role: 'VIEWER',
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New' },
      query: { id: 'clxxxxxxxxxxxxxxxxmiss0001' },
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- DELETE /api/customers/[id] ----

describe('DELETE /api/customers/[id]', () => {
  test('deletes customer when ADMIN and logs audit', async () => {
    const existing = { id: 'clxxxxxxxxxxxxxxxxcust0001', name: 'Acme', clientCode: 'ACME01' };
    prisma.customer.findUnique.mockResolvedValue(existing);
    prisma.customer.delete.mockResolvedValue({});
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'clxxxxxxxxxxxxxxxxcust0001' } });
    await idHandler(req, res);
    expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: 'clxxxxxxxxxxxxxxxxcust0001' } });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', resource: 'customer', resourceId: 'clxxxxxxxxxxxxxxxxcust0001' })
    );
  });

  test('returns 403 for EDITOR role', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'clxxxxxxxxxxxxxxxxcust0001' }, role: 'EDITOR' });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'clxxxxxxxxxxxxxxxxmiss0001' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.customer.delete).not.toHaveBeenCalled();
  });
});
