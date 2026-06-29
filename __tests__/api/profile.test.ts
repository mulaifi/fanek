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
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth/guard', () => ({
  methodNotAllowed: (res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (b: unknown) => void } }, allowed: string[]) => { res.setHeader('Allow', allowed.join(', ')); res.status(405).json({ error: 'Method not allowed' }); },
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

const mockCheck = jest.fn();
jest.mock('@/lib/rateLimit', () => ({
  createRateLimiter: jest.fn(() => ({ check: (...args: unknown[]) => mockCheck(...args) })),
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

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};
const mockVerifyPassword = verifyPassword as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;
const mockCheckStrength = checkStrength as jest.Mock;

// Interactive-transaction client (`tx`) passed to the $transaction callback. The
// deletion handler issues a raw `FOR UPDATE` lock + count via tx.$queryRaw, then
// erases audit rows and the user via tx. We drive $transaction to invoke the real
// callback with this tx so the in-transaction last-admin guard is exercised.
const txQueryRaw = jest.fn();
const txAuditDeleteMany = jest.fn();
const txUserDelete = jest.fn();
const txClient = {
  $queryRaw: txQueryRaw,
  auditLog: { deleteMany: txAuditDeleteMany },
  user: { delete: txUserDelete },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockReturnValue({ allowed: true, remaining: 4 });
  // Default: run the interactive-transaction callback with our tx client and
  // propagate whatever it returns/throws (so the in-tx guard can abort the delete).
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txClient) => unknown) =>
    cb(txClient)
  );
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

    // Password change also stamps sessionsValidAfter to revoke existing JWT sessions.
    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'u1' });
    expect(updateArg.data.passwordHash).toBe('newhash');
    expect(updateArg.data.firstLogin).toBe(false);
    expect(updateArg.data.sessionsValidAfter).toBeInstanceOf(Date);
    expect(res.json).toHaveBeenCalledWith({ success: true, firstLogin: false });
  });

  test('stamps sessionsValidAfter to "now" on password change (invalidates existing sessions)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'oldhash' });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckStrength.mockReturnValue({ valid: true, errors: [] });
    mockHashPassword.mockResolvedValue('newhash');
    mockPrisma.user.update.mockResolvedValue({});

    const before = Date.now();
    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' } });
    await handler(req as never, res as never);
    const after = Date.now();

    const sva = mockPrisma.user.update.mock.calls[0][0].data.sessionsValidAfter as Date;
    expect(sva).toBeInstanceOf(Date);
    expect(sva.getTime()).toBeGreaterThanOrEqual(before);
    expect(sva.getTime()).toBeLessThanOrEqual(after);
  });

  test('does NOT set sessionsValidAfter when only the name changes', async () => {
    mockPrisma.user.update.mockResolvedValue({ name: 'Just Name' });

    const { req, res } = mockReqRes({ body: { name: 'Just Name' } });
    await handler(req as never, res as never);

    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect('sessionsValidAfter' in updateArg.data).toBe(false);
  });

  test('returns 400 for OAuth users with no passwordHash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: null });

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/OAuth/i);
  });

  test('returns 429 when rate limited', async () => {
    mockCheck.mockReturnValue({ allowed: false, remaining: 0 });

    const { req, res } = mockReqRes({ body: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].error).toMatch(/too many/i);
  });

  test('updates name only', async () => {
    mockPrisma.user.update.mockResolvedValue({ name: 'New Name' });

    const { req, res } = mockReqRes({ body: { name: 'New Name' } });
    await handler(req as never, res as never);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: 'New Name' },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, name: 'New Name' });
  });

  test('updates name and password together', async () => {
    mockPrisma.user.update.mockResolvedValue({ name: 'New Name' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'oldhash' });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckStrength.mockReturnValue({ valid: true, errors: [] });
    mockHashPassword.mockResolvedValue('newhash');

    const { req, res } = mockReqRes({
      body: { name: 'New Name', currentPassword: 'OldPass1!', newPassword: 'NewPass1!' },
    });
    await handler(req as never, res as never);

    // Single atomic update with all fields (incl. the session-invalidation stamp)
    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'u1' });
    expect(updateArg.data.name).toBe('New Name');
    expect(updateArg.data.passwordHash).toBe('newhash');
    expect(updateArg.data.firstLogin).toBe(false);
    expect(updateArg.data.sessionsValidAfter).toBeInstanceOf(Date);
    expect(res.json).toHaveBeenCalledWith({ success: true, name: 'New Name', firstLogin: false });
  });

  test('rejects empty body with 400', async () => {
    const { req, res } = mockReqRes({ body: {} });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/no update/i);
  });
});

describe('DELETE /api/profile (self-service account deletion)', () => {
  // The withAuth mock authenticates as user id 'u1'. The role used by the handler
  // comes from the DB record returned by findUnique, so each test sets it there.

  test('rejects when password confirmation is missing', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE', body: {} });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/password confirmation is required/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('rejects when the confirmation password is incorrect', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'VIEWER', passwordHash: 'hash' });
    mockVerifyPassword.mockResolvedValue(false);
    const { req, res } = mockReqRes({ method: 'DELETE', body: { password: 'wrong' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/incorrect/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('rejects OAuth users with no password hash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'VIEWER', passwordHash: null });
    const { req, res } = mockReqRes({ method: 'DELETE', body: { password: 'whatever' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/oauth/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('returns 404 when the user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'DELETE', body: { password: 'pw' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('refuses to delete the last remaining admin (409), inside the locking transaction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN', passwordHash: 'hash' });
    mockVerifyPassword.mockResolvedValue(true);
    // FOR UPDATE lock returns a single ADMIN row → this user is the last admin.
    txQueryRaw.mockResolvedValue([{ id: 'u1' }]);
    const { req, res } = mockReqRes({ method: 'DELETE', body: { password: 'correct' } });
    await handler(req as never, res as never);

    // The guard runs INSIDE the transaction, holding a row lock on the ADMIN rows.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txQueryRaw).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/only administrator/i);
    // Aborted before any deletion.
    expect(txAuditDeleteMany).not.toHaveBeenCalled();
    expect(txUserDelete).not.toHaveBeenCalled();
  });

  test('allows an admin to delete when another admin remains (within the transaction)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'admin@example.com',
      role: 'ADMIN',
      passwordHash: 'hash',
    });
    mockVerifyPassword.mockResolvedValue(true);
    // Lock returns two ADMIN rows → safe to delete this one.
    txQueryRaw.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    const { req, res } = mockReqRes({ method: 'DELETE', body: { password: 'correct' } });
    await handler(req as never, res as never);

    // Erases the user's own audit entries and the account itself, via the tx client.
    expect(txQueryRaw).toHaveBeenCalledTimes(1);
    expect(txAuditDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(txUserDelete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('allows a non-admin to delete without the admin lock check', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'viewer@example.com',
      role: 'VIEWER',
      passwordHash: 'hash',
    });
    mockVerifyPassword.mockResolvedValue(true);
    const { req, res } = mockReqRes({ method: 'DELETE', body: { password: 'correct' } });
    await handler(req as never, res as never);

    // No last-admin lock/count needed for non-admins.
    expect(txQueryRaw).not.toHaveBeenCalled();
    expect(txUserDelete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 429 when deletion attempts are rate limited', async () => {
    mockCheck.mockReturnValue({ allowed: false, remaining: 0 });
    const { req, res } = mockReqRes({ method: 'DELETE', body: { password: 'correct' } });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].error).toMatch(/too many/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('unsupported methods on /api/profile', () => {
  test('returns 405 for GET', async () => {
    const { req, res } = mockReqRes({ method: 'GET', body: {} });
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'PUT, DELETE');
  });
});
