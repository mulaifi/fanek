import indexHandler from '../../pages/api/services/index';
import idHandler from '../../pages/api/services/[id]';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    service: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    serviceType: {
      findUnique: jest.fn(),
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

const VALID_CUID_1 = 'clhz1234567890abcdefghijk';
const VALID_CUID_2 = 'clhz0987654321zyxwvutsrqp';
const VALID_SERVICE_ID = 'clhz1111111111aaaaaaaaaaa';

// ---- POST /api/services ----

describe('POST /api/services', () => {
  const mockServiceType = {
    id: VALID_CUID_2,
    name: 'Connectivity',
    fieldSchema: [
      { name: 'bandwidth', label: 'Bandwidth', type: 'text', required: true },
      { name: 'provider', label: 'Provider', type: 'text', required: false },
    ],
  };

  const mockCustomer = { id: VALID_CUID_1, name: 'Acme Corp' };

  const validBody = {
    customerId: VALID_CUID_1,
    serviceTypeId: VALID_CUID_2,
    fieldValues: { bandwidth: '100Mbps', provider: 'ISP Co' },
  };

  test('creates service with valid fieldValues', async () => {
    prisma.customer.findUnique.mockResolvedValue(mockCustomer);
    prisma.serviceType.findUnique.mockResolvedValue(mockServiceType);
    const created = { id: VALID_SERVICE_ID, ...validBody };
    prisma.service.create.mockResolvedValue(created);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', resource: 'service' })
    );
  });

  test('rejects missing required fields from fieldSchema with 400', async () => {
    prisma.customer.findUnique.mockResolvedValue(mockCustomer);
    prisma.serviceType.findUnique.mockResolvedValue(mockServiceType);
    const bodyMissingRequired = {
      customerId: VALID_CUID_1,
      serviceTypeId: VALID_CUID_2,
      fieldValues: { provider: 'ISP Co' }, // missing required 'bandwidth'
    };
    const { req, res } = mockReqRes({ method: 'POST', body: bodyMissingRequired });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toMatch(/Missing required fields/);
    expect(response.error).toMatch(/bandwidth/);
  });

  test('rejects missing customerId with 400', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { serviceTypeId: VALID_CUID_2, fieldValues: {} },
    });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toBe('Validation failed');
  });

  test('returns 400 when customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toMatch(/Customer not found/);
  });

  test('returns 400 when service type does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(mockCustomer);
    prisma.serviceType.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toMatch(/Service type not found/);
  });

  test('rejects VIEWER role with 403', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: validBody, role: 'VIEWER' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ---- Method not allowed on index ----

describe('index handler - unsupported methods', () => {
  test('returns 405 for GET', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ---- GET /api/services/[id] ----

describe('GET /api/services/[id]', () => {
  test('returns service with serviceType and customer name', async () => {
    const service = {
      id: VALID_SERVICE_ID,
      fieldValues: { bandwidth: '100Mbps' },
      serviceType: { id: VALID_CUID_2, name: 'Connectivity' },
      customer: { id: VALID_CUID_1, name: 'Acme Corp', clientCode: 'ACME01' },
    };
    prisma.service.findUnique.mockResolvedValue(service);
    const { req, res } = mockReqRes({ query: { id: VALID_SERVICE_ID } });
    await idHandler(req, res);
    expect(res.json).toHaveBeenCalledWith(service);
  });

  test('returns 404 when service not found', async () => {
    prisma.service.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { id: 'clxxxxxxxxxxxxxxxxmiss0001' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- PUT /api/services/[id] ----

describe('PUT /api/services/[id]', () => {
  test('updates fieldValues and logs audit', async () => {
    const existing = {
      id: VALID_SERVICE_ID,
      customerId: VALID_CUID_1,
      serviceTypeId: VALID_CUID_2,
      fieldValues: { bandwidth: '100Mbps' },
    };
    const updated = { ...existing, fieldValues: { bandwidth: '500Mbps' } };
    prisma.service.findUnique.mockResolvedValue(existing);
    prisma.service.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { fieldValues: { bandwidth: '500Mbps' } },
      query: { id: VALID_SERVICE_ID },
    });
    await idHandler(req, res);
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: VALID_SERVICE_ID },
      data: { fieldValues: { bandwidth: '500Mbps' } },
    });
    expect(res.json).toHaveBeenCalledWith(updated);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resource: 'service', resourceId: VALID_SERVICE_ID })
    );
  });

  test('returns 403 for VIEWER role', async () => {
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { fieldValues: {} },
      query: { id: VALID_SERVICE_ID },
      role: 'VIEWER',
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if service does not exist', async () => {
    prisma.service.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { fieldValues: {} },
      query: { id: 'clxxxxxxxxxxxxxxxxmiss0001' },
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- DELETE /api/services/[id] ----

describe('DELETE /api/services/[id]', () => {
  test('removes service and logs audit', async () => {
    const existing = {
      id: VALID_SERVICE_ID,
      customerId: VALID_CUID_1,
      serviceTypeId: VALID_CUID_2,
      fieldValues: {},
    };
    prisma.service.findUnique.mockResolvedValue(existing);
    prisma.service.delete.mockResolvedValue({});
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: VALID_SERVICE_ID } });
    await idHandler(req, res);
    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: VALID_SERVICE_ID } });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', resource: 'service', resourceId: VALID_SERVICE_ID })
    );
  });

  test('returns 403 for VIEWER role', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: VALID_SERVICE_ID }, role: 'VIEWER' });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if service does not exist', async () => {
    prisma.service.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'clxxxxxxxxxxxxxxxxmiss0001' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });
});
