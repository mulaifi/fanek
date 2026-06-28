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
    passwordResetToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  passwordResetToken: {
    deleteMany: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('token primitives', () => {
  test('generateRawToken returns a 64-char hex string', () => {
    const token = generateRawToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test('generateRawToken returns a unique value each call', () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });

  test('hashToken is deterministic and never equals the raw token', () => {
    const raw = generateRawToken();
    const h1 = hashToken(raw);
    const h2 = hashToken(raw);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(raw);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('createPasswordResetToken', () => {
  test('invalidates prior unused tokens, stores only the hash, sets 1h expiry, returns raw token', async () => {
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    const before = Date.now();
    const raw = await createPasswordResetToken('user-1');
    const after = Date.now();

    // Prior unused tokens for this user are deleted first
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
    });

    // Created record stores the HASH, never the raw token
    const createArg = mockPrisma.passwordResetToken.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe('user-1');
    expect(createArg.data.tokenHash).toBe(hashToken(raw));
    expect(createArg.data.tokenHash).not.toBe(raw);
    expect('token' in createArg.data).toBe(false);

    // Expiry is ~1 hour out
    const expiresAt = createArg.data.expiresAt as Date;
    const ms = expiresAt.getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 50);
    expect(ms).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 50);

    // Raw token is returned to the caller (for the email link)
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
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

describe('consumeResetToken', () => {
  test('marks the token used with a timestamp', async () => {
    mockPrisma.passwordResetToken.update.mockResolvedValue({});
    await consumeResetToken('t1');
    const arg = mockPrisma.passwordResetToken.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 't1' });
    expect(arg.data.usedAt).toBeInstanceOf(Date);
  });
});
