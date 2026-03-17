import indexHandler from '../../../pages/api/admin/users/index';
import idHandler from '../../../pages/api/admin/users/[id]';
import resetPasswordHandler from '../../../pages/api/admin/users/[id]/reset-password';
import revokeSessionsHandler from '../../../pages/api/admin/users/[id]/revoke-sessions';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import * as passwordLib from '@/lib/password';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
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

jest.mock('@/lib/password', () => ({
  generateTempPassword: jest.fn().mockReturnValue('TempPass123!'),
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
}));

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
});

// ---- GET /api/admin/users ----

describe('GET /api/admin/users', () => {
  test('returns list of users without passwordHash', async () => {
    const users = [
      { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'ADMIN', firstLogin: false, lastActiveAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'u2', name: 'Bob', email: 'bob@example.com', role: 'VIEWER', firstLogin: true, lastActiveAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    prisma.user.findMany.mockResolvedValue(users);
    const { req, res } = mockReqRes();
    await indexHandler(req, res);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
    expect(res.json).toHaveBeenCalledWith({ data: users });
    // Confirm select does not include passwordHash
    const callArgs = prisma.user.findMany.mock.calls[0][0];
    expect(callArgs.select.passwordHash).toBeUndefined();
  });

  test('returns 405 for DELETE method', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE' });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ---- POST /api/admin/users (invite) ----

describe('POST /api/admin/users', () => {
  const validBody = { name: 'Charlie', email: 'charlie@example.com', role: 'EDITOR' };

  test('creates user and returns user plus tempPassword', async () => {
    const createdUser = { id: 'u3', name: 'Charlie', email: 'charlie@example.com', role: 'EDITOR', firstLogin: true };
    prisma.user.create.mockResolvedValue(createdUser);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const response = res.json.mock.calls[0][0];
    expect(response.user).toEqual(createdUser);
    expect(response.tempPassword).toBe('TempPass123!');
    expect(passwordLib.generateTempPassword).toHaveBeenCalled();
    expect(passwordLib.hashPassword).toHaveBeenCalledWith('TempPass123!');
  });

  test('creates user with firstLogin: true by default', async () => {
    const createdUser = { id: 'u3', name: 'Charlie', email: 'charlie@example.com', role: 'EDITOR', firstLogin: true };
    prisma.user.create.mockResolvedValue(createdUser);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firstLogin: true, passwordHash: 'hashed-password' }),
      })
    );
  });

  test('logs audit on user creation', async () => {
    const createdUser = { id: 'u3', name: 'Charlie', email: 'charlie@example.com', role: 'EDITOR', firstLogin: true };
    prisma.user.create.mockResolvedValue(createdUser);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', resource: 'user', resourceId: 'u3' })
    );
  });

  test('rejects missing name with 400', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: { email: 'test@example.com' } });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects invalid email with 400', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: { name: 'Test', email: 'not-an-email' } });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects invalid role with 400', async () => {
    const { req, res } = mockReqRes({ method: 'POST', body: { name: 'Test', email: 'test@example.com', role: 'SUPERUSER' } });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 409 on duplicate email (P2002)', async () => {
    const err = new Error('Unique constraint');
    err.code = 'P2002';
    prisma.user.create.mockRejectedValue(err);
    const { req, res } = mockReqRes({ method: 'POST', body: validBody });
    await indexHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ---- GET /api/admin/users/[id] ----

describe('GET /api/admin/users/[id]', () => {
  test('returns single user without passwordHash', async () => {
    const user = { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'ADMIN' };
    prisma.user.findUnique.mockResolvedValue(user);
    const { req, res } = mockReqRes({ query: { id: 'u1' } });
    await idHandler(req, res);
    expect(res.json).toHaveBeenCalledWith(user);
    const callArgs = prisma.user.findUnique.mock.calls[0][0];
    expect(callArgs.select.passwordHash).toBeUndefined();
  });

  test('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { id: 'missing' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- PUT /api/admin/users/[id] (role change) ----

describe('PUT /api/admin/users/[id]', () => {
  test('updates user role and logs audit', async () => {
    const existing = { id: 'u2', name: 'Bob', email: 'bob@example.com', role: 'VIEWER' };
    const updated = { ...existing, role: 'EDITOR' };
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.user.update.mockResolvedValue(updated);
    const { req, res } = mockReqRes({ method: 'PUT', body: { role: 'EDITOR' }, query: { id: 'u2' } });
    await idHandler(req, res);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u2' }, data: { role: 'EDITOR' } })
    );
    expect(res.json).toHaveBeenCalledWith(updated);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resource: 'user', resourceId: 'u2' })
    );
  });

  test('rejects invalid role with 400', async () => {
    const { req, res } = mockReqRes({ method: 'PUT', body: { role: 'SUPERUSER' }, query: { id: 'u2' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'PUT', body: { role: 'EDITOR' }, query: { id: 'missing' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ---- DELETE /api/admin/users/[id] ----

describe('DELETE /api/admin/users/[id]', () => {
  test('deletes user and logs audit', async () => {
    const existing = { id: 'u2', name: 'Bob', email: 'bob@example.com', role: 'VIEWER' };
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.user.delete.mockResolvedValue({});
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'u2' } });
    await idHandler(req, res);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', resource: 'user', resourceId: 'u2' })
    );
  });

  test('prevents deleting own account (self-delete)', async () => {
    // admin-1 is the session user id from the mock
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'admin-1' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toMatch(/Cannot delete your own account/);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  test('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'DELETE', query: { id: 'missing' } });
    await idHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});

// ---- POST /api/admin/users/[id]/reset-password ----

describe('POST /api/admin/users/[id]/reset-password', () => {
  test('resets password and returns tempPassword', async () => {
    const user = { id: 'u2', name: 'Bob', email: 'bob@example.com' };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({});
    const { req, res } = mockReqRes({ method: 'POST', query: { id: 'u2' } });
    await resetPasswordHandler(req, res);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u2' },
        data: expect.objectContaining({ firstLogin: true }),
      })
    );
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.tempPassword).toBe('TempPass123!');
  });

  test('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'POST', query: { id: 'missing' } });
    await resetPasswordHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 405 for non-POST methods', async () => {
    const { req, res } = mockReqRes({ method: 'GET', query: { id: 'u2' } });
    await resetPasswordHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ---- POST /api/admin/users/[id]/revoke-sessions ----

describe('POST /api/admin/users/[id]/revoke-sessions', () => {
  test('deletes all sessions for user', async () => {
    const user = { id: 'u2', email: 'bob@example.com' };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.session.deleteMany.mockResolvedValue({ count: 3 });
    const { req, res } = mockReqRes({ method: 'POST', query: { id: 'u2' } });
    await revokeSessionsHandler(req, res);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u2' } });
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.sessionsRevoked).toBe(3);
  });

  test('logs audit after revoking sessions', async () => {
    const user = { id: 'u2', email: 'bob@example.com' };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.session.deleteMany.mockResolvedValue({ count: 2 });
    const { req, res } = mockReqRes({ method: 'POST', query: { id: 'u2' } });
    await revokeSessionsHandler(req, res);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resource: 'user', resourceId: 'u2' })
    );
  });

  test('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'POST', query: { id: 'missing' } });
    await revokeSessionsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 405 for non-POST methods', async () => {
    const { req, res } = mockReqRes({ method: 'GET', query: { id: 'u2' } });
    await revokeSessionsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
