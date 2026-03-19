export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Parse locale from cookie header string.
 * Used server-side in _document.tsx and API routes.
 */
export function getLocaleFromCookies(cookieHeader?: string): Locale {
  if (!cookieHeader) return DEFAULT_LOCALE;
  const match = cookieHeader.match(new RegExp(`${LOCALE_COOKIE}=([A-Za-z0-9_-]+)`));
  const value = match?.[1];
  return isValidLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Read locale from document.cookie (client-side).
 */
export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  return getLocaleFromCookies(document.cookie);
}

/**
 * Set locale cookie (client-side). Max-age 1 year.
 */
export function setLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

export function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale);
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
