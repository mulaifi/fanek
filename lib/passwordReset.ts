import { createHash, randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

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

/**
 * Create a single-use password reset token for a user.
 * Invalidates any prior unused tokens for that user, persists only the SHA-256 hash,
 * and returns the raw token for inclusion in the emailed reset link.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
}

export interface VerifiedToken {
  id: string;
  userId: string;
}

/**
 * Verify a raw reset token. Returns the token id + userId when the token exists,
 * is unused, and has not expired (expiry enforced server-side). Returns null otherwise.
 */
export async function verifyResetToken(raw: string): Promise<VerifiedToken | null> {
  if (!raw || typeof raw !== 'string') return null;
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  return { id: record.id, userId: record.userId };
}

/** Mark a reset token as used (single-use enforcement). */
export async function consumeResetToken(id: string): Promise<void> {
  await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}
