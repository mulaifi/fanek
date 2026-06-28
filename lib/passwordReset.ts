import { createHash, randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

/** Number of random bytes in a raw reset token (256 bits of entropy → 64 hex chars). */
const TOKEN_BYTES = 32;
/** Reset tokens are valid for one hour. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Generate a cryptographically random raw token. Only ever sent in the email link. */
export function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Hash a raw token with SHA-256. Only the hash is persisted; the raw token never
 * touches the database. Lookups are performed by hash (a unique-indexed column),
 * so token comparison is effectively a constant-time hashed lookup.
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** True for a Prisma P2002 (unique constraint) error, without importing the error class. */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === 'P2002';
}

/**
 * Create a single-use password reset token for a user.
 *
 * Atomically (in a transaction) invalidates any prior unused tokens and inserts a
 * new one storing only the SHA-256 hash. A DB-level partial unique index guarantees
 * at most one active token per user; if a concurrent request wins the race, the
 * insert raises P2002 — that is handled gracefully (logged, returns null) so the
 * enumeration-safe, fire-and-forget caller never surfaces an error.
 *
 * Returns the raw token for the emailed link, or null if another active token
 * already exists (i.e. a concurrent request already created/sent one).
 */
export async function createPasswordResetToken(userId: string): Promise<string | null> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
      await tx.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
    });
    return raw;
  } catch (err) {
    if (isUniqueViolation(err)) {
      logger.warn({ userId }, 'Concurrent password reset token create; an active token already exists');
      return null;
    }
    throw err;
  }
}

export interface VerifiedToken {
  id: string;
  userId: string;
}

/**
 * Read-only lookup of an active reset token by its raw value. Returns the token
 * id + userId when it exists, is unused, and has not expired; null otherwise.
 * Authoritative single-use enforcement happens in consumeResetToken (atomic).
 */
export async function verifyResetToken(raw: string): Promise<VerifiedToken | null> {
  if (!raw || typeof raw !== 'string') return null;
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  return { id: record.id, userId: record.userId };
}

/**
 * Atomically consume a reset token AND apply the new password hash in a single
 * transaction. The conditional updateMany (usedAt IS NULL AND not expired) is the
 * single-use guard: exactly one concurrent caller can flip usedAt, so a replayed
 * or racing request gets count !== 1 and the whole transaction is a no-op.
 *
 * Returns true when the password was reset; false when the token was already
 * used/expired (caller should return the generic invalid response, not a 500).
 */
export async function consumeResetToken(
  tokenId: string,
  userId: string,
  passwordHash: string
): Promise<boolean> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: tokenId, userId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) return false;
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, firstLogin: false },
    });
    // Invalidate any other outstanding tokens for this user.
    await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
    return true;
  });
}
