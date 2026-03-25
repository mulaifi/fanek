import handler from '../../pages/api/setup';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock('@/lib/auth/guard', () => ({
  methodNotAllowed: (res: any, allowed: string[]) => { res.setHeader('Allow', allowed.join(', ')); res.status(405).json({ error: 'Method not allowed' }); },
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    settings: { findUnique: jest.fn(), upsert: jest.fn() },
    user: { create: jest.fn() },
    serviceType: { create: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({
      settings: { upsert: jest.fn() },
      user: { create: jest.fn() },
      serviceType: { create: jest.fn() },
    })),
  },
}));

jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn().mockResolvedValue(null),
  invalidateSettingsCache: jest.fn(),
}));

function mockReqRes(body: unknown) {
  const req = { method: 'POST', body };
  const res = { setHeader: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return { req, res };
}

describe('POST /api/setup', () => {
  const originalEnv = process.env.NEXTAUTH_SECRET;
  beforeAll(() => { process.env.NEXTAUTH_SECRET = 'a'.repeat(64); });
  afterAll(() => { process.env.NEXTAUTH_SECRET = originalEnv; });

  test('rejects non-POST', async () => {
    const { req, res } = mockReqRes({});
    req.method = 'GET';
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('rejects missing admin fields', async () => {
    const { req, res } = mockReqRes({ admin: {}, org: { name: 'Test' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects weak password', async () => {
    const { req, res } = mockReqRes({
      admin: { name: 'Admin', email: 'a@b.com', password: 'weak' },
      org: { name: 'Test' },
    });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
