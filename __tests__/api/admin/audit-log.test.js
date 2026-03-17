import auditLogHandler from '../../../pages/api/admin/audit-log';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth/guard', () => ({
  withAdmin: (handler) => (req, res) => {
    req.session = { user: { id: 'admin-1', role: 'ADMIN' } };
    return handler(req, res);
  },
}));

function mockReqRes({ method = 'GET', body = {}, query = {} } = {}) {
  const req = { method, body, query };
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

// ---- GET /api/admin/audit-log ----

describe('GET /api/admin/audit-log', () => {
  test('returns paginated audit log entries with user info', async () => {
    const logs = [
      { id: 'log1', action: 'CREATE', resource: 'customer', userId: 'u1', createdAt: new Date(), user: { name: 'Alice', email: 'alice@example.com' } },
      { id: 'log2', action: 'DELETE', resource: 'customer', userId: 'u1', createdAt: new Date(), user: { name: 'Alice', email: 'alice@example.com' } },
    ];
    prisma.auditLog.findMany.mockResolvedValue(logs);
    const { req, res } = mockReqRes({ query: { limit: '25' } });
    await auditLogHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ data: logs, nextCursor: null });
    const callArgs = prisma.auditLog.findMany.mock.calls[0][0];
    expect(callArgs.include).toEqual({ user: { select: { name: true, email: true } } });
  });

  test('returns nextCursor when results exceed limit', async () => {
    const logs = [
      { id: 'log1', action: 'CREATE', resource: 'customer', user: { name: 'Alice', email: 'alice@example.com' } },
      { id: 'log2', action: 'UPDATE', resource: 'customer', user: { name: 'Alice', email: 'alice@example.com' } },
      { id: 'log3', action: 'DELETE', resource: 'customer', user: { name: 'Alice', email: 'alice@example.com' } },
    ];
    prisma.auditLog.findMany.mockResolvedValue(logs);
    const { req, res } = mockReqRes({ query: { limit: '2' } });
    await auditLogHandler(req, res);
    const response = res.json.mock.calls[0][0];
    expect(response.nextCursor).toBe('log2');
    expect(response.data).toHaveLength(2);
  });

  test('filters by action', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { action: 'CREATE' } });
    await auditLogHandler(req, res);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: 'CREATE' }) })
    );
  });

  test('filters by resource', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { resource: 'customer' } });
    await auditLogHandler(req, res);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ resource: 'customer' }) })
    );
  });

  test('filters by userId', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { userId: 'u1' } });
    await auditLogHandler(req, res);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) })
    );
  });

  test('filters by date range (from and to)', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { from: '2025-01-01', to: '2025-12-31' } });
    await auditLogHandler(req, res);
    const callArgs = prisma.auditLog.findMany.mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeDefined();
    expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);
    expect(callArgs.where.createdAt.lte).toBeInstanceOf(Date);
  });

  test('applies cursor-based pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { cursor: 'log5', limit: '10' } });
    await auditLogHandler(req, res);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'log5' }, skip: 1, take: 11 })
    );
  });

  test('returns 400 for invalid action filter', async () => {
    const { req, res } = mockReqRes({ query: { action: 'INVALID' } });
    await auditLogHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 for invalid resource filter', async () => {
    const { req, res } = mockReqRes({ query: { resource: 'bogus' } });
    await auditLogHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 405 for non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await auditLogHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
