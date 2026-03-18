import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { getSettings } from '@/lib/settings';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAuthProviders(value: Prisma.JsonValue): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const settings = await getSettings();
  if (!settings) {
    return res.json({ setupComplete: false });
  }

  const authProviders = parseAuthProviders(settings.authProviders);
  const google = isRecord(authProviders.google) ? authProviders.google : {};
  const googleOAuthEnabled = Boolean(google.enabled);

  return res.json({
    setupComplete: settings.setupComplete,
    orgName: settings.orgName,
    orgLogo: settings.orgLogo,
    googleOAuthEnabled,
  });
}
