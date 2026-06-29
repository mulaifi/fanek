import handler from '../../pages/api/profile/export';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    auditLog: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/auth/guard', () => ({
  methodNotAllowed: (
    res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (b: unknown) => void } },
    allowed: string[]
  ) => {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
  },
  withAuth: (h: (req: unknown, res: unknown) => unknown) => (req: Record<string, unknown>, res: unknown) => {
    req.session = { user: { id: 'u1', role: 'VIEWER' } };
    return h(req, res);
  },
}));

jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn().mockResolvedValue({ setupComplete: true }),
}));

jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  auditLog: { findMany: jest.Mock };
};
const mockLogAudit = logAudit as jest.Mock;

function mockReqRes({ method = 'GET' } = {}) {
  const req = { method, query: {}, body: {} };
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

describe('GET /api/profile/export', () => {
  const safeUser = {
    id: 'u1',
    name: 'Alice',
    email: 'alice@example.com',
    role: 'VIEWER',
    firstLogin: false,
    lastActiveAt: null,
    locale: 'en',
    image: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  test('returns the user record and their audit logs as a JSON download', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(safeUser);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { id: 'a1', action: 'UPDATE', resource: 'customer', resourceId: 'c1', details: {}, createdAt: new Date() },
    ]);

    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="fanek-my-data.json"'
    );
    expect(res.status).toHaveBeenCalledWith(200);

    const sent = JSON.parse(res.send.mock.calls[0][0]);
    expect(sent.user.email).toBe('alice@example.com');
    expect(sent.auditLogs).toHaveLength(1);
    expect(sent.exportedAt).toEqual(expect.any(String));
  });

  test('selects only safe fields and never the password hash or session watermark', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(safeUser);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    const select = mockPrisma.user.findUnique.mock.calls[0][0].select;
    expect(select.passwordHash).toBeUndefined();
    expect(select.sessionsValidAfter).toBeUndefined();
    expect(select.email).toBe(true);

    // Scopes audit logs to the requesting user only.
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } })
    );
  });

  test('audit-logs the export action', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(safeUser);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', action: 'EXPORT', resource: 'user', resourceId: 'u1' })
    );
  });

  test('returns 404 when the user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  test('returns 405 for non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
  });
});
