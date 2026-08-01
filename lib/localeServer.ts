import type { IncomingMessage } from 'http';
import { getToken } from 'next-auth/jwt';
import { getSettings } from '@/lib/settings';
import { getLocaleFromCookies, isValidLocale, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from '@/lib/i18n';

/**
 * The one definition of "which language should this request render in".
 *
 * Order, highest first:
 *   1. the locale saved on the user's profile, carried in the session token
 *   2. the NEXT_LOCALE cookie, if this device has explicitly chosen one
 *   3. the organisation default from settings
 *   4. English
 *
 * The profile beats the cookie so that signing in on a new device brings your
 * language with you. LocaleSwitcher writes both, so they only differ on a device
 * that has never switched.
 *
 * Reads the session token directly rather than through getServerSession: the
 * session callbacks issue a database query per read for the invalidation
 * watermark, which is not worth paying on every server render. Measured on a
 * production build against /dashboard, p50 2.01ms -> 3.69ms via getServerSession
 * and 2.01ms -> 2.09ms this way.
 */
export async function resolveLocale(req?: IncomingMessage): Promise<Locale> {
  if (!req) return DEFAULT_LOCALE;

  // Every lookup here is best-effort. This runs on the document render, including
  // the static prerender of /404 and /500 during `next build`, where there is no
  // database at all. Rendering in English beats failing to render.
  try {
    const token = await getToken({ req: req as never });
    const profileLocale = (token as { locale?: string | null } | null)?.locale;
    if (isValidLocale(profileLocale)) return profileLocale;
  } catch {
    /* unreadable token: fall through */
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader?.includes(`${LOCALE_COOKIE}=`)) {
    return getLocaleFromCookies(cookieHeader);
  }

  try {
    const settings = await getSettings();
    if (isValidLocale(settings?.defaultLocale)) return settings.defaultLocale;
  } catch {
    /* no database, or no settings row yet: fall through */
  }

  return DEFAULT_LOCALE;
}
