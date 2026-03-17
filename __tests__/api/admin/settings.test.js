import settingsHandler from '../../../pages/api/admin/settings';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import * as settingsLib from '@/lib/settings';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    settings: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      count: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}));

jest.mock('@/lib/auth/guard', () => ({
  withAdmin: (handler) => (req, res) => {
    req.session = { user: { id: 'admin-1', role: 'ADMIN' } };
    return handler(req, res);
  },
}));

jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn(),
  invalidateSettingsCache: jest.fn(),
}));

jest.mock('@/lib/encryption', () => ({
  encrypt: jest.fn((val) => `encrypted:${val}`),
}));

const mockSettings = {
  id: 'default',
  orgName: 'Test Org',
  orgLogo: null,
  setupComplete: true,
  authProviders: {},
  customerStatuses: ['Active', 'Suspended', 'Evaluation'],
  sessionMaxAge: 2592000,
  sessionIdleTimeout: 86400,
  createdAt: new Date(),
  updatedAt: new Date(),
};

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
  settingsLib.getSettings.mockResolvedValue(mockSettings);
});

// ---- GET /api/admin/settings ----

describe('GET /api/admin/settings', () => {
  test('returns full settings', async () => {
    const { req, res } = mockReqRes();
    await settingsHandler(req, res);
    expect(settingsLib.getSettings).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(mockSettings);
  });

  test('returns 404 when settings not found', async () => {
    settingsLib.getSettings.mockResolvedValue(null);
    const { req, res } = mockReqRes();
    await settingsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 405 for unsupported methods', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE' });
    await settingsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ---- PUT /api/admin/settings ----

describe('PUT /api/admin/settings - orgName', () => {
  test('updates orgName successfully', async () => {
    const updated = { ...mockSettings, orgName: 'New Org Name' };
    prisma.settings.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({ method: 'PUT', body: { orgName: 'New Org Name' } });
    await settingsHandler(req, res);
    expect(prisma.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgName: 'New Org Name' }) })
    );
    expect(settingsLib.invalidateSettingsCache).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('logs audit with before/after on update', async () => {
    const updated = { ...mockSettings, orgName: 'New Org Name' };
    prisma.settings.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({ method: 'PUT', body: { orgName: 'New Org Name' } });
    await settingsHandler(req, res);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        resource: 'settings',
        details: expect.objectContaining({ before: mockSettings, after: updated }),
      })
    );
  });

  test('rejects empty orgName with 400', async () => {
    const { req, res } = mockReqRes({ method: 'PUT', body: { orgName: '' } });
    await settingsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when no valid fields provided', async () => {
    const { req, res } = mockReqRes({ method: 'PUT', body: {} });
    await settingsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('PUT /api/admin/settings - customerStatuses', () => {
  test('updates customerStatuses when no customers use removed status', async () => {
    prisma.customer.count.mockResolvedValue(0);
    const newStatuses = ['Active', 'Suspended']; // removed 'Evaluation'
    const updated = { ...mockSettings, customerStatuses: newStatuses };
    prisma.settings.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({ method: 'PUT', body: { customerStatuses: newStatuses } });
    await settingsHandler(req, res);
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { status: 'Evaluation' } });
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('blocks removal of status that is in use by customers', async () => {
    prisma.customer.count.mockResolvedValue(5);
    const { req, res } = mockReqRes({ method: 'PUT', body: { customerStatuses: ['Active', 'Suspended'] } });
    await settingsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toMatch(/Cannot remove status "Evaluation"/);
    expect(response.error).toMatch(/5 customer/);
    expect(prisma.settings.update).not.toHaveBeenCalled();
  });

  test('rejects empty customerStatuses array with 400', async () => {
    const { req, res } = mockReqRes({ method: 'PUT', body: { customerStatuses: [] } });
    await settingsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('PUT /api/admin/settings - authProviders', () => {
  test('encrypts clientSecret before storing', async () => {
    const updated = { ...mockSettings };
    prisma.settings.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({
      method: 'PUT',
      body: {
        authProviders: {
          google: { clientId: 'gid', clientSecret: 'secret123' },
        },
      },
    });
    await settingsHandler(req, res);
    const callArgs = prisma.settings.update.mock.calls[0][0];
    expect(callArgs.data.authProviders.google.clientSecret).toBe('encrypted:secret123');
  });
});

describe('PUT /api/admin/settings - session settings', () => {
  test('updates sessionMaxAge', async () => {
    const updated = { ...mockSettings, sessionMaxAge: 86400 };
    prisma.settings.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({ method: 'PUT', body: { sessionMaxAge: 86400 } });
    await settingsHandler(req, res);
    expect(prisma.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sessionMaxAge: 86400 }) })
    );
  });

  test('rejects non-positive sessionMaxAge with 400', async () => {
    const { req, res } = mockReqRes({ method: 'PUT', body: { sessionMaxAge: -100 } });
    await settingsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
