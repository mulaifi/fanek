import customersHandler from '../../pages/api/import/customers';
import servicesHandler from '../../pages/api/import/services';
import * as auditLib from '@/lib/audit';

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
  (auditLib.logAudit as jest.Mock).mockClear();
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

  test('null body returns 400 without writing', async () => {
    const { req, res } = mockReqRes(null);
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.createMany).not.toHaveBeenCalled();
  });

  test('duplicate mapping targets return 400 without writing', async () => {
    const dupMapping = { Name: 'name', AltName: 'name', Status: 'status' };
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping: dupMapping, dryRun: true });
    await (customersHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.createMany).not.toHaveBeenCalled();
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
    const logAudit = auditLib.logAudit as jest.Mock;
    mockState.svcCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, serviceTypeId, dryRun: false });
    await (servicesHandler as any)(req, res);
    expect(mockState.svcCreateMany).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].committed).toBe(1);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT',
        resource: 'service',
        details: expect.objectContaining({ serviceTypeId }),
      })
    );
  });

  test('rejects missing serviceTypeId', async () => {
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects missing dryRun', async () => {
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, serviceTypeId });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.svcCreateMany).not.toHaveBeenCalled();
  });

  test('rejects unknown service type', async () => {
    mockState.serviceType = null;
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, serviceTypeId, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('unique-constraint race during commit returns 409', async () => {
    mockState.svcCreateMany = jest.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping, serviceTypeId, dryRun: false });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('non-POST returns 405', async () => {
    const { req, res } = mockReqRes({}, 'GET');
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('null body returns 400 without writing', async () => {
    const { req, res } = mockReqRes(null);
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.svcCreateMany).not.toHaveBeenCalled();
  });

  test('duplicate mapping targets return 400 without writing', async () => {
    const dupMapping = { Customer: 'customerRef', AltCustomer: 'customerRef', Bandwidth: 'bandwidth' };
    const { req, res } = mockReqRes({ format: 'csv', data: csv, mapping: dupMapping, serviceTypeId, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockState.svcCreateMany).not.toHaveBeenCalled();
  });

  test('clientCode takes priority over customer name when they collide', async () => {
    // Customer A has clientCode 'x1'; Customer B has name 'X1' (different code)
    mockState.customers = [
      { id: 'ccust0000000000000000001', clientCode: 'x1', name: 'Customer A' },
      { id: 'ccust0000000000000000002', clientCode: 'x2', name: 'X1' },
    ];
    const refCsv = 'Customer,Bandwidth\nx1,100\n';
    const { req, res } = mockReqRes({ format: 'csv', data: refCsv, mapping, serviceTypeId, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.canCommit).toBe(true);
    expect(body.rows[0].data).toMatchObject({ customerId: 'ccust0000000000000000001' });
  });

  test('ambiguous customer name resolves as error (not silently picking the wrong customer)', async () => {
    // Two customers share the same name "Dup Co" - the name key is ambiguous
    mockState.customers = [
      { id: 'ccust0000000000000000010', clientCode: 'DC1', name: 'Dup Co' },
      { id: 'ccust0000000000000000011', clientCode: 'DC2', name: 'Dup Co' },
    ];
    const dupCsv = 'Customer,Bandwidth\nDup Co,50\n';
    const dupMapping = { Customer: 'customerRef', Bandwidth: 'bandwidth' };
    const { req, res } = mockReqRes({ format: 'csv', data: dupCsv, mapping: dupMapping, serviceTypeId, dryRun: true });
    await (servicesHandler as any)(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.canCommit).toBe(false);
    expect(body.rows[0].status).toBe('error');
  });
});
