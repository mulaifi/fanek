import handler from '../../../pages/api/admin/test-email';
import { getSettings } from '@/lib/settings';
import { isSmtpConfigured, sendTestEmail } from '@/lib/email';

jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));

jest.mock('@/lib/auth/guard', () => ({
  methodNotAllowed: (
    res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (b: unknown) => void } },
    allowed: string[]
  ) => {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withAdmin: (h: any) => (req: any, res: any) => {
    req.session = { user: { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' } };
    return h(req, res);
  },
}));

jest.mock('@/lib/settings', () => ({ getSettings: jest.fn() }));
jest.mock('@/lib/email', () => ({ isSmtpConfigured: jest.fn(), sendTestEmail: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockGetSettings = getSettings as jest.Mock;
const mockIsConfigured = isSmtpConfigured as jest.Mock;
const mockSendTest = sendTestEmail as jest.Mock;

function mockReqRes({ method = 'POST', body = {} as Record<string, unknown> } = {}) {
  const req: Record<string, unknown> = { method, body };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockResolvedValue({ smtp: { enabled: true } });
  mockIsConfigured.mockReturnValue(true);
  mockSendTest.mockResolvedValue(undefined);
});

describe('POST /api/admin/test-email', () => {
  test('rejects non-POST with 405', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 400 when SMTP is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);
    const { req, res } = mockReqRes({ body: { to: 'x@y.com' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSendTest).not.toHaveBeenCalled();
  });

  test('CR4: returns 400 for a malformed recipient address (does not attempt to send)', async () => {
    const { req, res } = mockReqRes({ body: { to: 'not-an-email' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/valid recipient/i);
    expect(mockSendTest).not.toHaveBeenCalled();
  });

  test('sends to a valid explicit recipient and returns 200', async () => {
    const { req, res } = mockReqRes({ body: { to: 'someone@example.com' } });
    await handler(req as never, res as never);
    expect(mockSendTest).toHaveBeenCalledWith(expect.anything(), 'someone@example.com');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual({ success: true, sentTo: 'someone@example.com' });
  });

  test('falls back to the admin session email when no recipient is provided', async () => {
    const { req, res } = mockReqRes({ body: {} });
    await handler(req as never, res as never);
    expect(mockSendTest).toHaveBeenCalledWith(expect.anything(), 'admin@example.com');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 502 when the transport throws on a valid address', async () => {
    mockSendTest.mockRejectedValue(new Error('smtp down'));
    const { req, res } = mockReqRes({ body: { to: 'someone@example.com' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(502);
  });
});
