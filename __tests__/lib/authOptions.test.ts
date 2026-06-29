import { getAuthOptions, isSessionStale } from '@/lib/auth/options';
import prisma from '@/lib/prisma';
import type { JWT } from 'next-auth/jwt';
import type { User } from 'next-auth';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn().mockResolvedValue({ authProviders: {}, sessionMaxAge: 2592000 }),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isSessionStale', () => {
  test('token with no snapshot stays valid when the user never invalidated sessions', () => {
    expect(isSessionStale(undefined, null)).toBe(false);
  });

  test('token with no snapshot is invalidated once a password change moves the watermark', () => {
    expect(isSessionStale(undefined, new Date(1000))).toBe(true);
  });

  test('token issued before the watermark is stale', () => {
    expect(isSessionStale(1000, new Date(2000))).toBe(true);
  });

  test('token issued at or after the watermark is valid', () => {
    expect(isSessionStale(2000, new Date(2000))).toBe(false);
    expect(isSessionStale(3000, new Date(2000))).toBe(false);
  });

  test('accepts ISO string watermarks', () => {
    expect(isSessionStale(1000, new Date(2000).toISOString())).toBe(true);
  });
});

describe('jwt callback session invalidation', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getJwt(): Promise<(args: any) => Promise<JWT>> {
    const options = await getAuthOptions();
    return options.callbacks!.jwt! as never;
  }

  test('snapshots the user sessionsValidAfter into the token on sign-in (no DB read)', async () => {
    const jwt = await getJwt();
    const token = await jwt({
      token: {} as JWT,
      user: {
        id: 'u1',
        role: 'ADMIN',
        firstLogin: false,
        sessionsValidAfter: new Date(5000),
      } as unknown as User,
    });
    expect(token.id).toBe('u1');
    expect((token as { sva?: number }).sva).toBe(5000);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('snapshots 0 when the user has never invalidated sessions', async () => {
    const jwt = await getJwt();
    const token = await jwt({
      token: {} as JWT,
      user: { id: 'u1', role: 'VIEWER', firstLogin: false, sessionsValidAfter: null } as unknown as User,
    });
    expect((token as { sva?: number }).sva).toBe(0);
  });

  test('keeps a fresh token valid (snapshot >= live watermark)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ sessionsValidAfter: new Date(1000) });
    const jwt = await getJwt();
    const token = await jwt({ token: { id: 'u1', sva: 1000 } as JWT });
    expect(token.id).toBe('u1');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { sessionsValidAfter: true },
    });
  });

  test('legacy token (no snapshot) is valid while the user has no watermark', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ sessionsValidAfter: null });
    const jwt = await getJwt();
    await expect(jwt({ token: { id: 'u1' } as JWT })).resolves.toBeDefined();
  });

  test('throws (invalidates) when the live watermark is newer than the token snapshot', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ sessionsValidAfter: new Date(9000) });
    const jwt = await getJwt();
    await expect(jwt({ token: { id: 'u1', sva: 1000 } as JWT })).rejects.toThrow(/invalidated/i);
  });

  test('throws when the user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const jwt = await getJwt();
    await expect(jwt({ token: { id: 'u1', sva: 1000 } as JWT })).rejects.toThrow(/invalidated/i);
  });

  test('still enforces invalidation during a client update() trigger', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ sessionsValidAfter: new Date(9000) });
    const jwt = await getJwt();
    await expect(
      jwt({ token: { id: 'u1', sva: 1000 } as JWT, trigger: 'update', session: { name: 'X' } })
    ).rejects.toThrow(/invalidated/i);
  });
});
