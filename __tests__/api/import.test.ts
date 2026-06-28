import customersHandler from '../../pages/api/import/customers';
import servicesHandler from '../../pages/api/import/services';

const mockState = {
  role: 'EDITOR' as string,
  existingCustomers: [] as { clientCode: string | null; name: string }[],
  createMany: jest.fn(),
  serviceType: { id: 'ctype00000000000000000001', fieldSchema: [{ name: 'bandwidth', label: 'Bandwidth', type: 'number', required: true }] } as any,
  svcCreateMany: jest.fn(),
  customers: [{ id: 'ccust0000000000000000001', clientCode: 'AC1', name: 'Acme' }] as { id: string; clientCode: string | null; name: string }[],
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
      findMany: async (args?: any) =>
        args?.select?.id ? mockState.customers : mockState.existingCustomers,
      createMany: (...args: unknown[]) => mockState.createMany(...args),
    },
    serviceType: { findUnique: async () => mockState.serviceType },
    service: { createMany: (...a: unknown[]) => mockState.svcCreateMany(...a) },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        customer: { createMany: (...a: unknown[]) => mockState.createMany(...a) },
        service: { createMany: (...a: unknown[]) => mockState.svcCreateMany(...a) },
      }),
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
  mockState.serviceType = { id: 'ctype00000000000000000001', fieldSchema: [{ name: 'bandwidth', label: 'Bandwidth', type: 'number', required: true }] } as any;
  mockState.svcCreateMany = jest.fn().mockResolvedValue({ count: 1 });
  mockState.customers = [{ id: 'ccust0000000000000000001', clientCode: 'AC1', name: 'Acme' }];
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

  test('invalid body (bad format) returns 400 without writing', async () => {
    const { req, res } = mockReqRes({ format: 'xml', data: 'x', mapping: {}, dryRun: true });
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.createMany).not.toHaveBeenCalled();
  });

  test('missing dryRun returns 400 without writing', async () => {
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping });
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.createMany).not.toHaveBeenCalled();
  });

  test('non-POST returns 405', async () => {
    const { req, res } = mockReqRes({}, 'GET');
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe('/api/import/services', () => {
  const csv = 'Customer,Bandwidth\nAC1,100\n';
  const mapping = { Customer: 'customerRef', Bandwidth: 'bandwidth' };
  const serviceTypeId = 'ctype00000000000000000001';

  test('dry-run validates without writing', async () => {
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, serviceTypeId, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.json.mock.calls[0][0].canCommit).toBe(true);
    expect(mockState.svcCreateMany).not.toHaveBeenCalled();
  });

  test('commit writes services and audits', async () => {
    mockState.svcCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, serviceTypeId, dryRun: false });
    await (servicesHandler as any)(req, res);
    expect(mockState.svcCreateMany).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].committed).toBe(1);
  });

  test('rejects missing serviceTypeId', async () => {
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects unknown service type', async () => {
    mockState.serviceType = null;
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, serviceTypeId, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
