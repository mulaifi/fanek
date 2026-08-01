import handler from '../../pages/api/settings';
import { getSettings } from '@/lib/settings';
import { isPasswordResetEnabled } from '@/lib/email';

jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));

jest.mock('@/lib/auth/guard', () => ({
  methodNotAllowed: (
    res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (b: unknown) => void } },
    allowed: string[]
  ) => {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
  },
}));

jest.mock('@/lib/settings', () => ({ getSettings: jest.fn() }));
jest.mock('@/lib/email', () => ({ isPasswordResetEnabled: jest.fn() }));

const mockGetSettings = getSettings as jest.Mock;
const mockResetEnabled = isPasswordResetEnabled as jest.Mock;

// Everything a real Settings row carries, including the fields this route exists
// to withhold. The leak tests below are only meaningful against a full row.
const fullSettings = {
  id: 'settings-1',
  setupComplete: true,
  orgName: 'LEAN',
  orgLogo: '/logo.svg',
  customerStatuses: ['Active', 'Suspended'],
  defaultLocale: 'ar',
  authProviders: {
    google: { enabled: true, clientId: 'google-client-id', clientSecret: 'super-secret' },
  },
  smtp: { host: 'smtp.example.com', user: 'mailer', pass: 'smtp-password' },
};

function mockReqRes({ method = 'GET' } = {}) {
  const req = { method };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockResolvedValue(fullSettings);
  mockResetEnabled.mockReturnValue(true);
});

describe('/api/settings', () => {
  test('returns exactly the public fields and nothing else', async () => {
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    const body = res.json.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'customerStatuses',
      'defaultLocale',
      'googleOAuthEnabled',
      'orgLogo',
      'orgName',
      'passwordResetEnabled',
      'setupComplete',
    ]);
  });

  test('never exposes SMTP or OAuth credentials', async () => {
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    const body = res.json.mock.calls[0][0];
    expect(body).not.toHaveProperty('authProviders');
    expect(body).not.toHaveProperty('smtp');
    // This route answers before login (pages/login.tsx and pages/forgot-password.tsx
    // both fetch it), so a serialized secret anywhere in the payload is a leak.
    expect(JSON.stringify(body)).not.toContain('super-secret');
    expect(JSON.stringify(body)).not.toContain('smtp-password');
    expect(JSON.stringify(body)).not.toContain('google-client-id');
  });

  test('reduces the Google provider config to a single boolean', async () => {
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);
    expect((res.json.mock.calls[0][0] as { googleOAuthEnabled: boolean }).googleOAuthEnabled).toBe(true);
  });

  test('googleOAuthEnabled is false when the provider is configured but disabled', async () => {
    mockGetSettings.mockResolvedValue({
      ...fullSettings,
      authProviders: { google: { enabled: false, clientId: 'google-client-id' } },
    });
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);
    expect((res.json.mock.calls[0][0] as { googleOAuthEnabled: boolean }).googleOAuthEnabled).toBe(false);
  });

  test('googleOAuthEnabled is false when authProviders is null', async () => {
    mockGetSettings.mockResolvedValue({ ...fullSettings, authProviders: null });
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);
    expect((res.json.mock.calls[0][0] as { googleOAuthEnabled: boolean }).googleOAuthEnabled).toBe(false);
  });

  test('defaultLocale falls back to en when unset', async () => {
    mockGetSettings.mockResolvedValue({ ...fullSettings, defaultLocale: null });
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);
    expect((res.json.mock.calls[0][0] as { defaultLocale: string }).defaultLocale).toBe('en');
  });

  test('passwordResetEnabled mirrors the email readiness gate', async () => {
    mockResetEnabled.mockReturnValue(false);
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    expect(mockResetEnabled).toHaveBeenCalledWith(fullSettings);
    expect((res.json.mock.calls[0][0] as { passwordResetEnabled: boolean }).passwordResetEnabled).toBe(false);
  });

  test('reports setupComplete false and nothing else before first run', async () => {
    mockGetSettings.mockResolvedValue(null);
    const { req, res } = mockReqRes();
    await handler(req as never, res as never);

    expect(res.json.mock.calls[0][0]).toEqual({ setupComplete: false });
    expect(mockResetEnabled).not.toHaveBeenCalled();
  });

  test('non-GET returns 405 with an Allow header', async () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
    expect(res.status).toHaveBeenCalledWith(405);
    expect(mockGetSettings).not.toHaveBeenCalled();
  });
});
