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
  withAuth: (h) => (req, res) => {
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/search', () => {
  test('returns empty arrays when query is missing', async () => {
    const { req, res } = mockReqRes({ query: {} });
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ customers: [], partners: [], services: [] });
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  test('returns empty arrays when query is blank whitespace', async () => {
    const { req, res } = mockReqRes({ query: { q: '   ' } });
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ customers: [], partners: [], services: [] });
  });

  test('returns grouped results for a valid search term', async () => {
    const customers = [{ id: 'c1', name: 'Acme', clientCode: 'ACM01', status: 'Active' }];
    const partners = [{ id: 'p1', name: 'Acme Partner', type: 'Reseller' }];
    const services = [{ id: 's1', notes: 'Acme note', serviceType: { name: 'Cloud' }, customer: { id: 'c1', name: 'Acme' } }];
    prisma.customer.findMany.mockResolvedValue(customers);
    prisma.partner.findMany.mockResolvedValue(partners);
    prisma.service.findMany.mockResolvedValue(services);

    const { req, res } = mockReqRes({ query: { q: 'Acme' } });
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ customers, partners, services });
  });

  test('limits results to 10 per group', async () => {
    const { req, res } = mockReqRes({ query: { q: 'test' } });
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.partner.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    await handler(req, res);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
    expect(prisma.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  test('returns 405 for non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
