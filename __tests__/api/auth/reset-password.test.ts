import handler from '../../../pages/api/auth/reset-password';
import { checkStrength, hashPassword } from '@/lib/password';
import { verifyResetToken, consumeResetToken } from '@/lib/passwordReset';
import { logAudit } from '@/lib/audit';

// The handler imports lib/auth/guard, which transitively loads the real Prisma
// client at module load (needs DATABASE_URL). The handler itself uses no Prisma
// directly (all DB work is behind the mocked lib/passwordReset), so a bare mock
// is enough to keep the import graph from touching a real database.
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));

jest.mock('@/lib/password', () => ({
  checkStrength: jest.fn(),
  hashPassword: jest.fn(),
}));

jest.mock('@/lib/passwordReset', () => ({
  verifyResetToken: jest.fn(),
  consumeResetToken: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockCheckStrength = checkStrength as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;
const mockVerify = verifyResetToken as jest.Mock;
const mockConsume = consumeResetToken as jest.Mock;
const mockLogAudit = logAudit as jest.Mock;

let ipCounter = 0;
function mockReqRes({ method = 'POST', body = {} as Record<string, unknown>, ip = '' } = {}) {
  // Unique IP per call by default so the per-IP rate limiter does not bleed across tests.
  const remoteAddress = ip || `10.1.0.${ipCounter++}`;
  const req = { method, body, headers: { host: 'app.example.com' }, socket: { remoteAddress } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckStrength.mockReturnValue({ valid: true, errors: [] });
  mockHashPassword.mockResolvedValue('newhash');
});

describe('POST /api/auth/reset-password', () => {
  test('rejects non-POST with 405', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('rejects missing token or password with 400', async () => {
    const { req, res } = mockReqRes({ body: { token: 'abc' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects an invalid/expired token with a generic 400 and does not consume', async () => {
    mockVerify.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { token: 'badtoken', password: 'Str0ng!Pass1' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/invalid or has expired/i);
    expect(mockConsume).not.toHaveBeenCalled();
  });

  test('rejects a weak password and does NOT consume the token', async () => {
    mockVerify.mockResolvedValue({ id: 't1', userId: 'u1' });
    mockCheckStrength.mockReturnValue({ valid: false, errors: ['Must contain a number'] });
    const { req, res } = mockReqRes({ body: { token: 'goodtoken', password: 'weak' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('Weak password');
    expect(mockConsume).not.toHaveBeenCalled();
  });

  test('on success: hashes password, atomically consumes token, audits, returns 200', async () => {
    mockVerify.mockResolvedValue({ id: 't1', userId: 'u1' });
    mockConsume.mockResolvedValue(true);

    const { req, res } = mockReqRes({ body: { token: 'goodtoken', password: 'Str0ng!Pass1' } });
    await handler(req as never, res as never);

    expect(mockHashPassword).toHaveBeenCalledWith('Str0ng!Pass1');
    // Atomic consume gets the verified id + userId + the new hash.
    expect(mockConsume).toHaveBeenCalledWith('t1', 'u1', 'newhash');
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', action: 'PASSWORD_RESET', resource: 'user' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual({ success: true });
  });

  test('race: token consumed between the read check and the atomic consume → generic 400, not 500, no audit', async () => {
    mockVerify.mockResolvedValue({ id: 't1', userId: 'u1' });
    mockConsume.mockResolvedValue(false); // updateMany matched 0 rows

    const { req, res } = mockReqRes({ body: { token: 'goodtoken', password: 'Str0ng!Pass1' } });
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toMatch(/invalid or has expired/i);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  test('returns 500 if the atomic consume throws unexpectedly', async () => {
    mockVerify.mockResolvedValue({ id: 't1', userId: 'u1' });
    mockConsume.mockRejectedValue(new Error('db down'));

    const { req, res } = mockReqRes({ body: { token: 'goodtoken', password: 'Str0ng!Pass1' } });
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  test('M3: rate limits after 10 attempts from the same IP (11th returns 429)', async () => {
    mockVerify.mockResolvedValue(null); // invalid token; we only care about limiting
    const ip = '198.51.100.55';
    for (let i = 0; i < 10; i++) {
      const { req, res } = mockReqRes({ body: { token: 'x', password: 'Str0ng!Pass1' }, ip });
      await handler(req as never, res as never);
      expect(res.status).not.toHaveBeenCalledWith(429);
    }
    const { req, res } = mockReqRes({ body: { token: 'x', password: 'Str0ng!Pass1' }, ip });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(429);
    // The 11th request is blocked before any token verification happens.
    expect(mockVerify).toHaveBeenCalledTimes(10);
  });
});
