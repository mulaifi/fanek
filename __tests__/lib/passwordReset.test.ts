import {
  generateRawToken,
  hashToken,
  createPasswordResetToken,
  verifyResetToken,
  consumeResetToken,
} from '@/lib/passwordReset';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    passwordResetToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { update: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  passwordResetToken: {
    deleteMany: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
  user: { update: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: $transaction runs the callback with the same mock as the tx client.
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockPrisma));
});

describe('token primitives', () => {
  test('generateRawToken returns a 64-char hex string', () => {
    expect(generateRawToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  test('generateRawToken returns a unique value each call', () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });

  test('hashToken is deterministic and never equals the raw token', () => {
    const raw = generateRawToken();
    const h1 = hashToken(raw);
    expect(h1).toBe(hashToken(raw));
    expect(h1).not.toBe(raw);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('createPasswordResetToken', () => {
  test('atomically invalidates prior unused tokens, stores only the hash, 1h expiry, returns raw token', async () => {
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    const before = Date.now();
    const raw = await createPasswordResetToken('user-1');
    const after = Date.now();

    // The work happens inside a transaction
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
    });

    const createArg = mockPrisma.passwordResetToken.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe('user-1');
    expect(createArg.data.tokenHash).toBe(hashToken(raw as string));
    expect(createArg.data.tokenHash).not.toBe(raw);
    expect('token' in createArg.data).toBe(false);

    const ms = (createArg.data.expiresAt as Date).getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 50);
    expect(ms).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 50);

    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  test('returns null on a concurrent P2002 unique violation (does not throw)', async () => {
    mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' });
    const raw = await createPasswordResetToken('user-1');
    expect(raw).toBeNull();
  });

  test('rethrows non-P2002 errors', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('db down'));
    await expect(createPasswordResetToken('user-1')).rejects.toThrow('db down');
  });
});

describe('verifyResetToken', () => {
  test('returns null for empty/invalid input', async () => {
    expect(await verifyResetToken('')).toBeNull();
    expect(await verifyResetToken(undefined as unknown as string)).toBeNull();
    expect(mockPrisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  test('looks up by hash, not by raw token', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    const raw = generateRawToken();
    await verifyResetToken(raw);
    expect(mockPrisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(raw) },
    });
  });

  test('returns null when no matching token exists', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    expect(await verifyResetToken(generateRawToken())).toBeNull();
  });

  test('returns null for an already-used token', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    });
    expect(await verifyResetToken(generateRawToken())).toBeNull();
  });

  test('returns null for an expired token', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await verifyResetToken(generateRawToken())).toBeNull();
  });

  test('returns id+userId for a valid, unused, unexpired token', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(await verifyResetToken(generateRawToken())).toEqual({ id: 't1', userId: 'u1' });
  });
});

describe('consumeResetToken (atomic)', () => {
  test('on a live token: flips usedAt, updates password, invalidates other tokens, returns true', async () => {
    mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });

    const result = await consumeResetToken('t1', 'u1', 'newhash');

    expect(result).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Conditional consume guards on usedAt: null AND not expired
    const updArg = mockPrisma.passwordResetToken.updateMany.mock.calls[0][0];
    expect(updArg.where.id).toBe('t1');
    expect(updArg.where.userId).toBe('u1');
    expect(updArg.where.usedAt).toBeNull();
    expect(updArg.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(updArg.data.usedAt).toBeInstanceOf(Date);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'newhash', firstLogin: false },
    });
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', usedAt: null },
    });
  });

  test('on an already-used/expired token (count !== 1): returns false and does NOT touch the user', async () => {
    mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await consumeResetToken('t1', 'u1', 'newhash');

    expect(result).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
  });
});
