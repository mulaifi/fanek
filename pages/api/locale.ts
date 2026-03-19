import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth/options';
import { isValidLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Check user profile setting
  const authOptions = await getAuthOptions();
  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.locale && isValidLocale(session.user.locale)) {
    return res.json({ locale: session.user.locale });
  }

  // 2. Check cookie (only if explicitly set)
  const cookieHeader = req.headers.cookie ?? '';
  const hasCookie = cookieHeader.includes(`${LOCALE_COOKIE}=`);
  if (hasCookie) {
    const match = cookieHeader.match(new RegExp(`${LOCALE_COOKIE}=([A-Za-z0-9_-]+)`));
    const cookieValue = match?.[1];
    if (cookieValue && isValidLocale(cookieValue)) {
      return res.json({ locale: cookieValue });
    }
  }

  // 3. Check org default
  const settings = await getSettings();
  const orgDefault = settings?.defaultLocale;
  if (orgDefault && isValidLocale(orgDefault)) {
    return res.json({ locale: orgDefault });
  }

  // 4. Fallback
  return res.json({ locale: DEFAULT_LOCALE });
}
