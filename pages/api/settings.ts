import type { NextApiRequest, NextApiResponse } from 'next';
import { getSettings } from '@/lib/settings';
import { methodNotAllowed } from '@/lib/auth/guard';
import { isPasswordResetEnabled } from '@/lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const settings = await getSettings();
  if (!settings) {
    res.json({ setupComplete: false });
    return;
  }

  // Return only public fields (no secrets, no auth provider configs)
  const authProviders = settings.authProviders as Record<string, Record<string, unknown>> | null;
  res.json({
    setupComplete: settings.setupComplete,
    orgName: settings.orgName,
    orgLogo: settings.orgLogo,
    customerStatuses: settings.customerStatuses,
    googleOAuthEnabled: !!authProviders?.google?.enabled,
    defaultLocale: settings.defaultLocale ?? 'en',
    // Whether the email-based password reset flow is available (drives the
    // "Forgot password?" link). Requires SMTP configured AND NEXTAUTH_URL set, so
    // the link matches the API's actual readiness. Exposes only a boolean.
    passwordResetEnabled: isPasswordResetEnabled(settings),
  });
}
