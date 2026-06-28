import type { NextApiRequest, NextApiResponse } from 'next';
import { checkStrength, hashPassword } from '@/lib/password';
import { verifyResetToken, consumeResetToken } from '@/lib/passwordReset';
import { createRateLimiter } from '@/lib/rateLimit';
import { methodNotAllowed } from '@/lib/auth/guard';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

// 10 reset attempts per 15 minutes per IP (limits brute-forcing of reset tokens).
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

// X-Forwarded-For is caller-controlled; only trust it behind a reverse proxy (TRUST_PROXY).
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

function getClientIp(req: NextApiRequest): string {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim();
    if (Array.isArray(xff) && xff.length > 0) return xff[0]!;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const ip = getClientIp(req);
  const { allowed } = limiter.check(`reset:${ip}`);
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
    return;
  }

  const { token, password } = (req.body ?? {}) as { token?: unknown; password?: unknown };
  if (typeof token !== 'string' || token === '' || typeof password !== 'string' || password === '') {
    res.status(400).json({ error: 'Token and password are required' });
    return;
  }

  // Read-only check first so a valid token survives a weak-password attempt and the
  // user can retry (we don't consume it until the password passes validation).
  const verified = await verifyResetToken(token);
  if (!verified) {
    res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    return;
  }

  const strength = checkStrength(password);
  if (!strength.valid) {
    res.status(400).json({ error: 'Weak password', details: strength.errors });
    return;
  }

  let success: boolean;
  try {
    const passwordHash = await hashPassword(password);
    // Atomic: consume the token (single-use guard) + set the new password +
    // invalidate other tokens, all in one transaction. No half-applied state.
    success = await consumeResetToken(verified.id, verified.userId, passwordHash);
  } catch (err) {
    logger.error({ err }, 'reset-password processing failed');
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    return;
  }

  // The token was used/expired between the read check and the atomic consume
  // (replay/race). Return the same generic invalid response, never a 500.
  if (!success) {
    res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    return;
  }

  await logAudit({
    userId: verified.userId,
    action: 'PASSWORD_RESET',
    resource: 'user',
    resourceId: verified.userId,
  });
  logger.info({ userId: verified.userId }, 'Password reset completed');

  res.status(200).json({ success: true });
}
