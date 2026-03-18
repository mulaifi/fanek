import handler from '../../pages/api/search';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    customer: { findMany: jest.fn() },
    partner: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/auth/guard', () => ({
  withAuth: (h: (req: unknown, res: unknown) => unknown) => (req: Record<string, unknown>, res: unknown) => {
    req.session = { user: { id: 'u1', role: 'ADMIN' } };
    return h(req, res);
  },
}));

jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn().mockResolvedValue({ setupComplete: true }),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

function mockReqRes({ method = 'GET', query = {} } = {}) {
  const req = { method, query };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

const mockPrisma = prisma as {
  customer: { findMany: jest.Mock };
  partner: { findMany: jest.Mock };
  service: { findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/search', () => {
  test('returns empty arrays when query is missing', async () => {
    const { req, res } = mockReqRes({ query: {} });
    await handler(req as never, res as never);
    expect(res.json).toHaveBeenCalledWith({ customers: [], partners: [], services: [] });
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
  });

  test('returns empty arrays when query is blank whitespace', async () => {
    const { req, res } = mockReqRes({ query: { q: '   ' } });
    await handler(req as never, res as never);
    expect(res.json).toHaveBeenCalledWith({ customers: [], partners: [], services: [] });
  });

  test('returns grouped results for a valid search term', async () => {
    const customers = [{ id: 'c1', name: 'Acme', clientCode: 'ACM01', status: 'Active' }];
    const partners = [{ id: 'p1', name: 'Acme Partner', type: 'Reseller' }];
    const services = [{ id: 's1', notes: 'Acme note', serviceType: { name: 'Cloud' }, customer: { id: 'c1', name: 'Acme' } }];
    mockPrisma.customer.findMany.mockResolvedValue(customers);
    mockPrisma.partner.findMany.mockResolvedValue(partners);
    mockPrisma.service.findMany.mockResolvedValue(services);

    const { req, res } = mockReqRes({ query: { q: 'Acme' } });
    await handler(req as never, res as never);

    expect(res.json).toHaveBeenCalledWith({ customers, partners, services });
  });

  test('limits results to 10 per group', async () => {
    const { req, res } = mockReqRes({ query: { q: 'test' } });
    mockPrisma.customer.findMany.mockResolvedValue([]);
    mockPrisma.partner.findMany.mockResolvedValue([]);
    mockPrisma.service.findMany.mockResolvedValue([]);
    await handler(req as never, res as never);

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
    expect(mockPrisma.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
    expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  test('returns 405 for non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
