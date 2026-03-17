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
  withAuth: (h) => (req, res) => {
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
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/profile', () => {
  test('rejects missing currentPassword with 400', async () => {
    const { req, res } = mockReqRes({ body: { newPassword: 'NewPass1!' } });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/required/i);
  });

  test('rejects missing newPassword with 400', async () => {
    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!' } });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/required/i);
  });

  test('rejects when current password is incorrect', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hashed' });
    verifyPassword.mockResolvedValue(false);

    const { req, res } = mockReqRes({ body: { currentPassword: 'WrongPass1!', newPassword: 'NewPass1!' } });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/incorrect/i);
  });

  test('rejects weak new password with 400 and details', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hashed' });
    verifyPassword.mockResolvedValue(true);
    checkStrength.mockReturnValue({ valid: false, errors: ['Must contain a number'] });

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'weakpassword' } });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('Weak password');
    expect(body.details).toContain('Must contain a number');
  });

  test('updates passwordHash and sets firstLogin false on success', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'oldhash' });
    verifyPassword.mockResolvedValue(true);
    checkStrength.mockReturnValue({ valid: true, errors: [] });
    hashPassword.mockResolvedValue('newhash');
    prisma.user.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' } });
    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'newhash', firstLogin: false },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, firstLogin: false });
  });

  test('returns 400 for OAuth users with no passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: null });

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' } });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/OAuth/i);
  });
});
