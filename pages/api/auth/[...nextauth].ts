import type { NextApiRequest, NextApiResponse } from 'next';
import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth/options';
import { createRateLimiter } from '@/lib/rateLimit';
import logger from '@/lib/logger';

// 10 credential-login attempts per 15 minutes per IP (brute-force / credential-stuffing defense).
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

// X-Forwarded-For is caller-controlled and trivially spoofed when the app is
// exposed directly, so it is only honored when TRUST_PROXY is set (i.e. the app
// runs behind a reverse proxy that sets the header). Otherwise the unspoofable
// socket address is used as the rate-limit key.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

function getClientIp(req: NextApiRequest): string {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim();
    if (Array.isArray(xff) && xff.length > 0) return xff[0]!;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

// Only the credentials sign-in POST (/api/auth/callback/credentials) is rate limited.
// Session/csrf/provider reads and OAuth callbacks are left untouched.
function isCredentialLogin(req: NextApiRequest): boolean {
  const nextauth = req.query.nextauth;
  const segments = Array.isArray(nextauth) ? nextauth : nextauth ? [nextauth] : [];
  return req.method === 'POST' && segments[0] === 'callback' && segments[1] === 'credentials';
}

export default async function auth(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (isCredentialLogin(req)) {
    const ip = getClientIp(req);
    const { allowed } = loginLimiter.check(`login:${ip}`);
    if (!allowed) {
      logger.warn({ ip }, 'Login rate limit exceeded');
      // Mirror NextAuth's redirect:false error shape so the client surfaces it cleanly:
      // a `url` carrying ?error=RateLimited (the login page maps this to a message).
      const baseUrl = process.env.NEXTAUTH_URL ?? `http://${req.headers.host ?? 'localhost'}`;
      res.status(429).json({ url: `${baseUrl}/login?error=RateLimited` });
      return;
    }
  }
  const options = await getAuthOptions();
  return NextAuth(req, res, options);
}
