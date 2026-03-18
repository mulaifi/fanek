import handler from '../../pages/api/profile';
import prisma from '@/lib/prisma';
import { verifyPassword, hashPassword, checkStrength } from '@/lib/password';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth/guard', () => ({
  withAuth: (h: (req: unknown, res: unknown) => unknown) => (req: Record<string, unknown>, res: unknown) => {
    req.session = { user: { id: 'u1', role: 'ADMIN' } };
    return h(req, res);
  },
}));

jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn().mockResolvedValue({ setupComplete: true }),
}));

jest.mock('@/lib/password', () => ({
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
  checkStrength: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

function mockReqRes({ method = 'PUT', body = {} } = {}) {
  const req = { method, body };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return { req, res };
}

const mockPrisma = prisma as {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};
const mockVerifyPassword = verifyPassword as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;
const mockCheckStrength = checkStrength as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/profile', () => {
  test('rejects missing currentPassword with 400', async () => {
    const { req, res } = mockReqRes({ body: { newPassword: 'NewPass1!' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/required/i);
  });

  test('rejects missing newPassword with 400', async () => {
    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/required/i);
  });

  test('rejects when current password is incorrect', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hashed' });
    mockVerifyPassword.mockResolvedValue(false);

    const { req, res } = mockReqRes({ body: { currentPassword: 'WrongPass1!', newPassword: 'NewPass1!' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/incorrect/i);
  });

  test('rejects weak new password with 400 and details', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hashed' });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckStrength.mockReturnValue({ valid: false, errors: ['Must contain a number'] });

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'weakpassword' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0] as { error: string; details: string[] };
    expect(body.error).toBe('Weak password');
    expect(body.details).toContain('Must contain a number');
  });

  test('updates passwordHash and sets firstLogin false on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'oldhash' });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckStrength.mockReturnValue({ valid: true, errors: [] });
    mockHashPassword.mockResolvedValue('newhash');
    mockPrisma.user.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' } });
    await handler(req as never, res as never);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'newhash', firstLogin: false },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, firstLogin: false });
  });

  test('returns 400 for OAuth users with no passwordHash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: null });

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/OAuth/i);
  });

  test('returns 429 after too many password change attempts', async () => {
    const body = { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' };
    // Exhaust the rate limit (5 attempts)
    for (let i = 0; i < 5; i++) {
      const { req, res } = mockReqRes({ body });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hashed' });
      mockVerifyPassword.mockResolvedValue(false);
      await handler(req as never, res as never);
    }
    // 6th attempt should be rate limited
    const { req, res } = mockReqRes({ body });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].error).toMatch(/too many/i);
  });
});
