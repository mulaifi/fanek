import handler from '../../pages/api/auth/[...nextauth]';
import NextAuth from 'next-auth';

// Use the REAL rate limiter (lib/rateLimit) so the test exercises actual limiting.
jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/lib/auth/options', () => ({ getAuthOptions: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockNextAuth = NextAuth as unknown as jest.Mock;

function loginReq(ip: string) {
  const req = {
    method: 'POST',
    query: { nextauth: ['callback', 'credentials'] },
    headers: { 'x-forwarded-for': ip, host: 'app.example.com' },
    socket: { remoteAddress: ip },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth handler rate limiting', () => {
  test('allows the first 10 credential logins then blocks the 11th per IP', async () => {
    const ip = '203.0.113.10';

    for (let i = 0; i < 10; i++) {
      const { req, res } = loginReq(ip);
      await handler(req as never, res as never);
      expect(res.status).not.toHaveBeenCalledWith(429);
    }
    expect(mockNextAuth).toHaveBeenCalledTimes(10);

    // 11th attempt is blocked without reaching NextAuth.
    const { req, res } = loginReq(ip);
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(429);
    const body = res.json.mock.calls[0][0] as { url: string };
    expect(body.url).toContain('error=RateLimited');
    expect(mockNextAuth).toHaveBeenCalledTimes(10); // unchanged
  });

  test('separate IPs have independent buckets', async () => {
    const { req, res } = loginReq('203.0.113.99');
    await handler(req as never, res as never);
    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(mockNextAuth).toHaveBeenCalledTimes(1);
  });

  test('non-login requests (session reads) are never rate limited', async () => {
    const req = {
      method: 'GET',
      query: { nextauth: ['session'] },
      headers: { host: 'app.example.com' },
      socket: { remoteAddress: '203.0.113.1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    // Far more than the limit; none should be blocked.
    for (let i = 0; i < 30; i++) {
      await handler(req as never, res as never);
    }
    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(mockNextAuth).toHaveBeenCalledTimes(30);
  });
});
