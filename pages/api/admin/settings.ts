import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { getSettings, invalidateSettingsCache } from '@/lib/settings';
import { encrypt } from '@/lib/encryption';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';
import { isValidLocale } from '@/lib/i18n';

type OAuthProviderConfig = Record<string, string | undefined>;
type AuthProvidersInput = {
  google?: OAuthProviderConfig;
  microsoft?: OAuthProviderConfig;
};

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method === 'GET') {
    const settings = await getSettings();
    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }
    // Redact encrypted secrets from auth providers before sending to client
    const sanitizedSettings: Record<string, unknown> = { ...settings };
    if (settings.authProviders && typeof settings.authProviders === 'object' && !Array.isArray(settings.authProviders)) {
      const providers = { ...(settings.authProviders as Record<string, Record<string, unknown>>) };
      for (const providerKey of Object.keys(providers)) {
        if (providers[providerKey]?.clientSecret) {
          providers[providerKey] = { ...providers[providerKey], clientSecret: '••••••••' };
        }
      }
      sanitizedSettings.authProviders = providers;
    }
    res.json(sanitizedSettings);
    return;
  }

  if (req.method === 'PUT') {
    const existing = await getSettings();
    if (!existing) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    const {
      orgName,
      orgLogo,
      customerStatuses,
      authProviders,
      sessionMaxAge,
      sessionIdleTimeout,
      defaultLocale,
    } = req.body as {
      orgName?: unknown;
      orgLogo?: unknown;
      customerStatuses?: unknown;
      authProviders?: AuthProvidersInput;
      sessionMaxAge?: unknown;
      sessionIdleTimeout?: unknown;
      defaultLocale?: unknown;
    };

    const updateData: Record<string, unknown> = {};

    if (orgName !== undefined) {
      if (typeof orgName !== 'string' || orgName.trim() === '') {
        res.status(400).json({ error: 'orgName must be a non-empty string' });
        return;
      }
      updateData.orgName = orgName.trim();
    }

    if (orgLogo !== undefined) {
      updateData.orgLogo = orgLogo;
    }

    if (customerStatuses !== undefined) {
      if (!Array.isArray(customerStatuses) || customerStatuses.length === 0) {
        res.status(400).json({ error: 'customerStatuses must be a non-empty array' });
        return;
      }

      // Check for statuses being removed
      const currentStatuses = (existing.customerStatuses as string[]) || [];
      const removedStatuses = currentStatuses.filter((s: string) => !customerStatuses.includes(s));

      for (const statusToRemove of removedStatuses) {
        const count = await prisma.customer.count({ where: { status: statusToRemove } });
        if (count > 0) {
          res.status(400).json({
            error: `Cannot remove status "${statusToRemove}": ${count} customer(s) currently use this status`,
          });
          return;
        }
      }

      updateData.customerStatuses = customerStatuses;
    }

    if (authProviders !== undefined) {
      // Check if any client secret needs encryption
      const needsEncryption = !!(authProviders.google?.clientSecret || authProviders.microsoft?.clientSecret);
      const secret = process.env.NEXTAUTH_SECRET;
      if (needsEncryption && !secret) {
        res.status(500).json({ error: 'NEXTAUTH_SECRET is not configured. Cannot encrypt OAuth credentials.' });
        return;
      }

      const existingProviders =
        existing.authProviders && typeof existing.authProviders === 'object' && !Array.isArray(existing.authProviders)
          ? (existing.authProviders as Record<string, OAuthProviderConfig>)
          : {};
      const providers: Record<string, OAuthProviderConfig> = { ...existingProviders };

      if (authProviders.google) {
        providers.google = { ...(providers.google ?? {}), ...authProviders.google };
        // Encrypt clientSecret if being set
        if (authProviders.google.clientSecret) {
          providers.google.clientSecret = encrypt(
            authProviders.google.clientSecret,
            secret!
          );
        }
      }

      if (authProviders.microsoft) {
        providers.microsoft = { ...(providers.microsoft ?? {}), ...authProviders.microsoft };
        if (authProviders.microsoft.clientSecret) {
          providers.microsoft.clientSecret = encrypt(
            authProviders.microsoft.clientSecret,
            secret!
          );
        }
      }

      updateData.authProviders = providers;
    }

    if (sessionMaxAge !== undefined) {
      if (typeof sessionMaxAge !== 'number' || sessionMaxAge <= 0) {
        res.status(400).json({ error: 'sessionMaxAge must be a positive number' });
        return;
      }
      updateData.sessionMaxAge = sessionMaxAge;
    }

    if (sessionIdleTimeout !== undefined) {
      if (typeof sessionIdleTimeout !== 'number' || sessionIdleTimeout <= 0) {
        res.status(400).json({ error: 'sessionIdleTimeout must be a positive number' });
        return;
      }
      updateData.sessionIdleTimeout = sessionIdleTimeout;
    }

    if (defaultLocale !== undefined) {
      if (!isValidLocale(defaultLocale)) {
        res.status(400).json({ error: 'defaultLocale must be "en" or "ar"' });
        return;
      }
      updateData.defaultLocale = defaultLocale;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const updated = await prisma.settings.update({
      where: { id: 'default' },
      data: updateData,
    });

    invalidateSettingsCache();

    await logAudit({
      userId: req.session.user.id,
      action: 'UPDATE',
      resource: 'settings',
      resourceId: 'default',
      details: { before: existing, after: updated },
    });

    logger.info({ fields: Object.keys(updateData) }, 'Settings updated');

    res.json(updated);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

export default withAdmin(handler);
