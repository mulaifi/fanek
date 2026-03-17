import { getSettings } from '@/lib/settings';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const settings = await getSettings();
  if (!settings) {
    return res.json({ setupComplete: false });
  }

  // Return only public fields
  return res.json({
    setupComplete: settings.setupComplete,
    orgName: settings.orgName,
    orgLogo: settings.orgLogo,
    googleOAuthEnabled: !!settings.authProviders?.google?.enabled,
  });
}
