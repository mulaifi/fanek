import customersHandler from '../../pages/api/import/customers';

const mockState = {
  role: 'EDITOR' as string,
  existingCustomers: [] as { clientCode: string | null; name: string }[],
  createMany: jest.fn(),
};

jest.mock('@/lib/auth/guard', () => ({
  withEditor: (h: unknown) => h,
  methodNotAllowed: (res: any, allowed: string[]) => {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
  },
}));
jest.mock('@/lib/settings', () => ({ getSettings: async () => ({ customerStatuses: ['Active', 'Inactive'] }) }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    customer: {
      findMany: async () => mockState.existingCustomers,
      createMany: (...args: unknown[]) => mockState.createMany(...args),
    },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ customer: { createMany: (...a: unknown[]) => mockState.createMany(...a) } }),
  },
}));

function mockReqRes(body: unknown, method = 'POST') {
  const req = { method, body, session: { user: { id: 'u1', role: mockState.role } } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
  return { req, res };
}

beforeEach(() => {
  mockState.role = 'EDITOR';
  mockState.existingCustomers = [];
  mockState.createMany = jest.fn().mockResolvedValue({ count: 1 });
});

describe('/api/import/customers', () => {
  const csv = 'Name,Client Code,Status\nAcme,AC1,Active\n';
  const mapping = { Name: 'name', 'Client Code': 'clientCode', Status: 'status' };

  test('dry-run returns a report without writing', async () => {
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, dryRun: true });
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockState.createMany).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.canCommit).toBe(true);
    expect(body.validCount).toBe(1);
  });

  test('commit writes via createMany and reports committed count', async () => {
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, dryRun: false });
    await (customersHandler as any)(req, res);
    expect(mockState.createMany).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].committed).toBe(1);
  });

  test('commit refuses when a row is invalid (atomic block)', async () => {
    const badCsv = 'Name,Client Code,Status\n,AC1,Active\n';
    const { req, res } = mockReqRes({ format: 'csv', data: badCsv, mapping, dryRun: false });
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.createMany).not.toHaveBeenCalled();
  });

  test('unique-constraint race during commit returns 409', async () => {
    mockState.createMany = jest.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, dryRun: false });
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('non-POST returns 405', async () => {
    const { req, res } = mockReqRes({}, 'GET');
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
