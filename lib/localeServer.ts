import type { IncomingMessage, ServerResponse } from 'http';
import { getToken } from 'next-auth/jwt';
import { getSettings } from '@/lib/settings';
import { getLocaleFromCookies, isValidLocale, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from '@/lib/i18n';

/**
 * The one definition of "which language should this request render in".
 *
 * Order, highest first:
 *   1. the NEXT_LOCALE cookie, if this device has explicitly chosen one
 *   2. the locale saved on the user's profile, carried in the session token
 *   3. the organisation default from settings
 *   4. English
 *
 * The cookie wins because the resolved value is published back to it: anything
 * ranked above the cookie would overwrite a choice the user had just made. A
 * device that has never chosen carries no cookie, so signing in on a new device
 * still brings your language with you, which is the documented promise at
 * docs/en/user-guide.md:233.
 *
 * Reads the session token directly rather than through getServerSession: the
 * session callbacks issue a database query per read for the invalidation
 * watermark, which is not worth paying on every server render. Measured on a
 * production build against /dashboard, p50 2.01ms -> 3.69ms via getServerSession
 * and 2.01ms -> 2.09ms this way.
 */
export async function resolveLocale(req?: IncomingMessage): Promise<Locale> {
  return (await resolveLocaleWithSource(req)).locale;
}

/**
 * As resolveLocale, but says where the answer came from. Only a 'token' answer is
 * worth writing to the cookie: it is the one the device does not already know and
 * cannot work out for itself. Publishing a 'default' answer would stamp English
 * onto every browser that renders /login before signing in, and that stamp would
 * then outrank the profile on the very next request.
 */
export async function resolveLocaleWithSource(
  req?: IncomingMessage
): Promise<{ locale: Locale; source: 'cookie' | 'token' | 'default' }> {
  if (!req) return { locale: DEFAULT_LOCALE, source: 'default' };

  // The cookie is this device's explicit choice and wins. It has to: publishing
  // the resolved value back to the cookie means anything ranked above it would
  // overwrite a switch the user just made. LocaleSwitcher.tsx:12 sets the cookie
  // and only then PUTs the profile, and it swallows a failed PUT on purpose, so
  // ranking the profile higher would silently undo the switch whenever that PUT
  // failed. A device that has never chosen has no cookie, which is exactly the
  // case the profile is here to serve.
  const cookieHeader = req.headers.cookie;
  if (cookieHeader?.includes(`${LOCALE_COOKIE}=`)) {
    return { locale: getLocaleFromCookies(cookieHeader), source: 'cookie' };
  }

  // Every lookup below is best-effort. This runs on the document render, including
  // the static prerender of /404 and /500 during `next build`, where there is no
  // database at all. Rendering in English beats failing to render.
  try {
    const token = await getToken({ req: req as never });
    const profileLocale = (token as { locale?: string | null } | null)?.locale;
    if (isValidLocale(profileLocale)) return { locale: profileLocale, source: 'token' };
  } catch {
    /* unreadable token: fall through */
  }

  try {
    const settings = await getSettings();
    if (isValidLocale(settings?.defaultLocale)) {
      return { locale: settings.defaultLocale, source: 'default' };
    }
  } catch {
    /* no database, or no settings row yet: fall through */
  }

  return { locale: DEFAULT_LOCALE, source: 'default' };
}

// X-Forwarded-Proto is caller-controlled and trivially spoofed when the app is
// exposed directly, so it is only honored when TRUST_PROXY is set — the same rule
// pages/api/auth/[...nextauth].ts:11-18, forgot-password.ts:18-23 and
// reset-password.ts:12-17 apply to X-Forwarded-For.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

/**
 * Is this request being served over HTTPS?
 *
 * Getting this wrong costs the feature in both directions. A Secure cookie set on
 * a plain-HTTP deployment is never sent back, so the language silently stops
 * persisting; no Secure on an HTTPS deployment writes a cookie the client-side
 * writer would have marked Secure, leaving two cookies that differ by attribute.
 *
 * Three sources, none of them caller-controlled unless the operator has said the
 * header can be trusted:
 *   1. NEXTAUTH_URL, which the operator sets and both production guides require
 *   2. a TLS socket, for the case where Node terminates HTTPS itself
 *   3. X-Forwarded-Proto, only behind TRUST_PROXY
 */
export function isSecureRequest(req: IncomingMessage): boolean {
  const authUrl = process.env.NEXTAUTH_URL;
  if (authUrl?.startsWith('https://')) return true;

  if ((req.socket as { encrypted?: boolean } | undefined)?.encrypted) return true;

  if (TRUST_PROXY) {
    const proto = req.headers['x-forwarded-proto'];
    const first = Array.isArray(proto) ? proto[0] : proto;
    if (typeof first === 'string' && first.split(',')[0]!.trim() === 'https') return true;
  }

  return false;
}

/**
 * Publish the resolved locale to the NEXT_LOCALE cookie when the request did not
 * already carry it.
 *
 * The client half of the app reads the language from that cookie alone
 * (lib/i18n.ts:22, used by pages/_app.tsx:36). Without this, a device that has
 * never chosen a language renders every translated string in English inside the
 * right-to-left shell the server just resolved for it: a mirrored layout full of
 * English words, which is worse than being wholly in English.
 *
 * Browsers apply Set-Cookie before running page scripts, so the value is already
 * there when _app reads it, and every later request resolves from the cookie
 * without touching the token.
 *
 * Name, path, lifetime and SameSite match setLocaleCookie in lib/i18n.ts, so the
 * two writers address the same cookie. Secure is the one attribute they derive
 * differently and cannot share: the client reads window.location.protocol, which
 * this side has no access to, and this side reads the deployment configuration,
 * which the client has no access to. isSecureRequest below is written to reach
 * the same answer on every deployment the repo documents.
 */
export function publishLocaleCookie(
  req: IncomingMessage | undefined,
  res: ServerResponse | undefined,
  locale: Locale
): void {
  if (!req || !res || res.headersSent) return;

  const cookieHeader = req.headers.cookie;
  if (cookieHeader?.includes(`${LOCALE_COOKIE}=`) && getLocaleFromCookies(cookieHeader) === locale) {
    return;
  }

  const secure = isSecureRequest(req) ? ';Secure' : '';
  const cookie = `${LOCALE_COOKIE}=${locale};Path=/;Max-Age=${60 * 60 * 24 * 365};SameSite=Lax${secure}`;

  // Append rather than assign: NextAuth sets its own cookies on this response.
  const existing = res.getHeader('Set-Cookie');
  const all = Array.isArray(existing) ? [...existing, cookie] : existing ? [String(existing), cookie] : [cookie];
  res.setHeader('Set-Cookie', all);
}
