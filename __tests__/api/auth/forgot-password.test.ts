import handler from '../../../pages/api/auth/forgot-password';
import prisma from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { isSmtpConfigured, sendPasswordResetEmail } from '@/lib/email';
import { createPasswordResetToken } from '@/lib/passwordReset';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));

jest.mock('@/lib/settings', () => ({ getSettings: jest.fn() }));

jest.mock('@/lib/email', () => ({
  isSmtpConfigured: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('@/lib/passwordReset', () => ({ createPasswordResetToken: jest.fn() }));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockPrisma = prisma as unknown as { user: { findUnique: jest.Mock } };
const mockGetSettings = getSettings as jest.Mock;
const mockIsConfigured = isSmtpConfigured as jest.Mock;
const mockSend = sendPasswordResetEmail as jest.Mock;
const mockCreateToken = createPasswordResetToken as jest.Mock;

let ipCounter = 0;
function mockReqRes({ method = 'POST', body = {} as Record<string, unknown> } = {}) {
  // Unique IP per call so the per-IP+email rate limiter does not bleed across tests
  const ip = `10.0.0.${ipCounter++}`;
  const req = { method, body, headers: { host: 'app.example.com' }, socket: { remoteAddress: ip } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockResolvedValue({ smtp: { enabled: true } });
  mockIsConfigured.mockReturnValue(true);
  mockCreateToken.mockResolvedValue('rawtoken123');
});

describe('POST /api/auth/forgot-password', () => {
  test('rejects non-POST with 405', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('rejects missing email with 400', async () => {
    const { req, res } = mockReqRes({ body: {} });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns generic 200 and sends email when user exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', passwordHash: 'h' });
    const { req, res } = mockReqRes({ body: { email: 'User@Example.com' } });
    await handler(req as never, res as never);

    // email normalized to lowercase for lookup
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
    expect(mockCreateToken).toHaveBeenCalledWith('u1');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const url = mockSend.mock.calls[0][2] as string;
    expect(url).toContain('/reset-password?token=rawtoken123');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns the SAME generic 200 when user does NOT exist (no enumeration)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { email: 'ghost@example.com' } });
    await handler(req as never, res as never);

    expect(mockCreateToken).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not send for OAuth-only users (no passwordHash) but still returns 200', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'oauth@example.com', passwordHash: null });
    const { req, res } = mockReqRes({ body: { email: 'oauth@example.com' } });
    await handler(req as never, res as never);

    expect(mockCreateToken).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns generic 200 without sending when SMTP not configured', async () => {
    mockIsConfigured.mockReturnValue(false);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', passwordHash: 'h' });
    const { req, res } = mockReqRes({ body: { email: 'user@example.com' } });
    await handler(req as never, res as never);

    expect(mockCreateToken).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('still returns generic 200 if sending throws (no leak)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', passwordHash: 'h' });
    mockSend.mockRejectedValue(new Error('smtp down'));
    const { req, res } = mockReqRes({ body: { email: 'user@example.com' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rate limits after 5 requests for the same IP+email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const ip = '198.51.100.7';
    for (let i = 0; i < 5; i++) {
      const req = { method: 'POST', body: { email: 'rl@example.com' }, headers: { host: 'h' }, socket: { remoteAddress: ip } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
      await handler(req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }
    const req = { method: 'POST', body: { email: 'rl@example.com' }, headers: { host: 'h' }, socket: { remoteAddress: ip } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
