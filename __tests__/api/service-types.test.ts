import indexHandler from '../../pages/api/service-types/index';
import idHandler from '../../pages/api/service-types/[id]';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    serviceType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    service: {
      count: jest.fn(),
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

// ---- GET /api/service-types ----

describe('GET /api/service-types', () => {
  test('returns list ordered by sortOrder', async () => {
    const serviceTypes = [
      { id: 'st1', name: 'Connectivity', sortOrder: 1, _count: { services: 3 } },
      { id: 'st2', name: 'Security', sortOrder: 2, _count: { services: 1 } },
    ];
    prisma.serviceType.findMany.mockResolvedValue(serviceTypes);
    const { req, res } = mockReqRes();
    await indexHandler(req, res);
    expect(prisma.serviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: 'asc' } })
    );
    expect(res.json).toHaveBeenCalledWith({ data: serviceTypes });
  });

  test('filters by active=true when query param provided', async () => {
    prisma.serviceType.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { active: 'true' } });
    await indexHandler(req, res);
    expect(prisma.serviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    );
  });

  test('returns all service types without active filter when not specified', async () => {
    prisma.serviceType.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes();
    await indexHandler(req, res);
    expect(prisma.serviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});

// ---- POST /api/service-types ----

describe('POST /api/service-types', () => {
  const validBody = {
    name: 'Connectivity',
    description: 'Internet connectivity services',
    fieldSchema: [
      { name: 'bandwidth', label: 'Bandwidth', type: 'text', required: true },
    ],
    sortOrder: 1,
    active: true,
  };

  test('creates service type with valid data', async () => {
    const created = { id: 'st1', ...validBody };
    prisma.serviceType.create.mockResolvedValue(created);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', resource: 'serviceType' })
    );
  });

  test('rejects invalid field type in fieldSchema with 400', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: {
        name: 'Connectivity',
        fieldSchema: [
          { name: 'bandwidth', label: 'Bandwidth', type: 'invalid_type', required: true },
        ],
      },
    });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toBe('Validation failed');
  });

  test('rejects missing name with 400', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { fieldSchema: [] },
    });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects non-ADMIN role with 403', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: validBody, role: 'EDITOR' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects VIEWER role with 403', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: validBody, role: 'VIEWER' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
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

// ---- GET /api/service-types/[id] ----

describe('GET /api/service-types/[id]', () => {
  test('returns service type with service count', async () => {
    const serviceType = { id: 'st1', name: 'Connectivity', _count: { services: 5 } };
    prisma.serviceType.findUnique.mockResolvedValue(serviceType);
    const { req, res } = mockReqRes({ query: { id: 'st1' } });
    await idHandler(req, res);
    expect(res.json).toHaveBeenCalledWith(serviceType);
  });

  test('returns 404 when service type not found', async () => {
    prisma.serviceType.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { id: 'missing' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- PUT /api/service-types/[id] ----

describe('PUT /api/service-types/[id]', () => {
  test('updates service type and logs audit', async () => {
    const existing = { id: 'st1', name: 'Old Name', fieldSchema: [], sortOrder: 1, active: true };
    const updated = { ...existing, name: 'New Name' };
    prisma.serviceType.findUnique.mockResolvedValue(existing);
    prisma.serviceType.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New Name' },
      query: { id: 'st1' },
    });
    await idHandler(req, res);
    expect(prisma.serviceType.update).toHaveBeenCalledWith({
      where: { id: 'st1' },
      data: { name: 'New Name' },
    });
    expect(res.json).toHaveBeenCalledWith(updated);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resource: 'serviceType', resourceId: 'st1' })
    );
  });

  test('returns 403 for EDITOR role', async () => {
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New' },
      query: { id: 'st1' },
      role: 'EDITOR',
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if service type does not exist', async () => {
    prisma.serviceType.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: { name: 'New' },
      query: { id: 'missing' },
    });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- DELETE /api/service-types/[id] ----

describe('DELETE /api/service-types/[id]', () => {
  test('returns 409 when services exist for this type', async () => {
    const existing = { id: 'st1', name: 'Connectivity' };
    prisma.serviceType.findUnique.mockResolvedValue(existing);
    prisma.service.count.mockResolvedValue(3);
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'st1' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toMatch(/Cannot delete service type with existing services/);
    expect(prisma.serviceType.delete).not.toHaveBeenCalled();
  });

  test('deletes service type and logs audit when no services exist', async () => {
    const existing = { id: 'st1', name: 'Connectivity' };
    prisma.serviceType.findUnique.mockResolvedValue(existing);
    prisma.service.count.mockResolvedValue(0);
    prisma.serviceType.delete.mockResolvedValue({});
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'st1' } });
    await idHandler(req, res);
    expect(prisma.serviceType.delete).toHaveBeenCalledWith({ where: { id: 'st1' } });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', resource: 'serviceType', resourceId: 'st1' })
    );
  });

  test('returns 403 for EDITOR role', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'st1' }, role: 'EDITOR' });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 if service type does not exist', async () => {
    prisma.serviceType.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'missing' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.serviceType.delete).not.toHaveBeenCalled();
  });
});
