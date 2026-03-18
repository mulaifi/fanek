import type { NextApiRequest, NextApiResponse } from 'next';
import { getSettings } from '@/lib/settings';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const settings = await getSettings();
  if (!settings) {
    res.json({ setupComplete: false });
    return;
  }

  // Return only public fields
  const authProviders = settings.authProviders as Record<string, Record<string, unknown>> | null;
  res.json({
    setupComplete: settings.setupComplete,
    orgName: settings.orgName,
    orgLogo: settings.orgLogo,
    googleOAuthEnabled: !!authProviders?.google?.enabled,
  });
}
