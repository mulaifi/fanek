import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { isSmtpConfigured, sendPasswordResetEmail } from '@/lib/email';
import { createPasswordResetToken } from '@/lib/passwordReset';
import { createRateLimiter } from '@/lib/rateLimit';
import { methodNotAllowed } from '@/lib/auth/guard';
import logger from '@/lib/logger';

// 5 reset requests per 15 minutes, keyed by IP + email (brute-force / abuse defense).
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

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

// Identical generic response regardless of whether the account exists — prevents
// user enumeration.
const GENERIC = {
  message: 'If an account with that email exists, a password reset link has been sent.',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const { email } = (req.body ?? {}) as { email?: unknown };
  if (typeof email !== 'string' || email.trim() === '') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  const normalized = email.toLowerCase().trim();

  const ip = getClientIp(req);
  const { allowed } = limiter.check(`forgot:${ip}:${normalized}`);
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
    return;
  }

  // Fire-and-forget: the DB lookup + email send are NOT awaited, so response
  // latency is constant whether or not the account exists (defends against
  // timing-based user enumeration). All work is best-effort and errors are
  // swallowed (logged) so the response never branches.
  //
  // This relies on a long-running Node server that keeps executing the detached
  // task after the response is flushed — correct for self-hosted Fanek. It would
  // NOT be safe on a serverless platform that freezes the process post-response.
  void (async () => {
    try {
      // Reset links must be built from the configured canonical URL only. The
      // caller-controlled Host header is never used (defends against host
      // header poisoning of the emailed link).
      const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/+$/, '');
      if (!baseUrl) {
        logger.warn('NEXTAUTH_URL is not configured; skipping password reset email');
        return;
      }

      const settings = await getSettings();
      if (!isSmtpConfigured(settings)) return;

      const user = await prisma.user.findUnique({ where: { email: normalized } });
      // Only credential users (those with a password hash) get a reset link.
      if (!user || !user.passwordHash) return;

      const rawToken = await createPasswordResetToken(user.id);
      // Encode the token so it can never break out of the URL/href attribute.
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await sendPasswordResetEmail(settings, user.email, resetUrl);
      logger.info({ userId: user.id }, 'Password reset email sent');
    } catch (err) {
      logger.error({ err }, 'forgot-password processing failed');
    }
  })();

  res.status(200).json(GENERIC);
}
