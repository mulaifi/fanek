import handler from '../../../pages/api/admin/export';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    customer: { findMany: jest.fn() },
    partner: { findMany: jest.fn() },
    serviceType: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
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
  withAdmin:
    (h: (req: Record<string, unknown>, res: unknown) => unknown) =>
    (req: Record<string, unknown>, res: unknown) => {
      req.session = { user: { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' } };
      return h(req, res);
    },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  customer: { findMany: jest.Mock };
  partner: { findMany: jest.Mock };
  serviceType: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};

function mockReqRes({ method = 'GET' } = {}) {
  const req: Record<string, unknown> = { method };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.customer.findMany.mockResolvedValue([
    { id: 'c1', name: 'Acme', services: [{ id: 's1', serviceType: { id: 't1', name: 'VDC' } }] },
  ]);
  mockPrisma.partner.findMany.mockResolvedValue([{ id: 'p1', name: 'Reseller' }]);
  mockPrisma.serviceType.findMany.mockResolvedValue([{ id: 't1', name: 'VDC' }]);
  mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'admin@example.com', role: 'ADMIN' }]);
});

describe('/api/admin/export', () => {
  test('GET returns every dataset plus an ISO exportedAt stamp', async () => {
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    const body = res.json.mock.calls[0][0] as {
      exportedAt: string;
      customers: unknown[];
      partners: unknown[];
      serviceTypes: unknown[];
      users: unknown[];
    };
    expect(body.customers).toHaveLength(1);
    expect(body.partners).toHaveLength(1);
    expect(body.serviceTypes).toHaveLength(1);
    expect(body.users).toHaveLength(1);
    expect(Number.isNaN(new Date(body.exportedAt).getTime())).toBe(false);
  });

  test('users are read through an explicit select that cannot reach the password hash', async () => {
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    const args = mockPrisma.user.findMany.mock.calls[0][0] as { select: Record<string, boolean> };
    expect(args.select).toBeDefined();
    expect(Object.keys(args.select)).toEqual(
      expect.arrayContaining(['id', 'name', 'email', 'role', 'createdAt'])
    );
    // A select is an allow-list: anything absent cannot be returned. Naming the
    // credential fields explicitly is what stops a later `include` from leaking them.
    expect(args.select).not.toHaveProperty('password');
    expect(args.select).not.toHaveProperty('passwordHash');
  });

  test('customers carry their services and each service its type', async () => {
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    const args = mockPrisma.customer.findMany.mock.calls[0][0] as {
      include: { services: { include: { serviceType: boolean } } };
    };
    expect(args.include.services.include.serviceType).toBe(true);
  });

  test('non-GET returns 405 with an Allow header', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
    expect(res.status).toHaveBeenCalledWith(405);
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});
