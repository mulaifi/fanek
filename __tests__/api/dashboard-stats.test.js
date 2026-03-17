import handler from '../../pages/api/dashboard/stats';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    customer: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    service: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    partner: {
      count: jest.fn(),
    },
    serviceType: {
      findMany: jest.fn(),
    },
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

function mockReqRes({ method = 'GET' } = {}) {
  const req = { method };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/dashboard/stats', () => {
  test('returns all stat fields with correct counts', async () => {
    prisma.customer.count.mockResolvedValue(5);
    prisma.service.count.mockResolvedValue(12);
    prisma.partner.count.mockResolvedValue(3);
    prisma.customer.groupBy.mockResolvedValue([
      { status: 'Active', _count: { status: 4 } },
      { status: 'Suspended', _count: { status: 1 } },
    ]);
    prisma.service.groupBy.mockResolvedValue([
      { serviceTypeId: 'st1', _count: { serviceTypeId: 8 } },
      { serviceTypeId: 'st2', _count: { serviceTypeId: 4 } },
    ]);
    prisma.customer.findMany.mockResolvedValue([
      { id: 'c1', name: 'Acme', clientCode: 'AC01', status: 'Active', updatedAt: new Date() },
    ]);
    prisma.serviceType.findMany.mockResolvedValue([
      { id: 'st1', name: 'Cloud', icon: 'cloud' },
      { id: 'st2', name: 'Networking', icon: null },
    ]);

    const { req, res } = mockReqRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result.totalCustomers).toBe(5);
    expect(result.totalServices).toBe(12);
    expect(result.totalPartners).toBe(3);
    expect(result.customersByStatus).toHaveLength(2);
    expect(result.servicesByType).toHaveLength(2);
    expect(result.recentCustomers).toHaveLength(1);
  });

  test('enriches servicesByType with names and icons', async () => {
    prisma.customer.count.mockResolvedValue(0);
    prisma.service.count.mockResolvedValue(0);
    prisma.partner.count.mockResolvedValue(0);
    prisma.customer.groupBy.mockResolvedValue([]);
    prisma.service.groupBy.mockResolvedValue([
      { serviceTypeId: 'st1', _count: { serviceTypeId: 3 } },
    ]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.serviceType.findMany.mockResolvedValue([
      { id: 'st1', name: 'Cloud Storage', icon: 'storage' },
    ]);

    const { req, res } = mockReqRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result.servicesByType[0]).toMatchObject({
      serviceTypeId: 'st1',
      name: 'Cloud Storage',
      icon: 'storage',
      count: 3,
    });
  });

  test('uses "Unknown" for service types not found', async () => {
    prisma.customer.count.mockResolvedValue(0);
    prisma.service.count.mockResolvedValue(0);
    prisma.partner.count.mockResolvedValue(0);
    prisma.customer.groupBy.mockResolvedValue([]);
    prisma.service.groupBy.mockResolvedValue([
      { serviceTypeId: 'missing-id', _count: { serviceTypeId: 2 } },
    ]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.serviceType.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result.servicesByType[0].name).toBe('Unknown');
    expect(result.servicesByType[0].icon).toBeNull();
  });

  test('returns 405 for non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
