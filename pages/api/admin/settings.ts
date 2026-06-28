import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin, methodNotAllowed } from '@/lib/auth/guard';
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

type SmtpInput = {
  enabled?: unknown;
  host?: unknown;
  port?: unknown;
  secure?: unknown;
  user?: unknown;
  pass?: unknown;
  from?: unknown;
};

function redactAuthSecrets(settings: Record<string, unknown>): Record<string, unknown> {
  const result = { ...settings };
  if (settings.authProviders && typeof settings.authProviders === 'object' && !Array.isArray(settings.authProviders)) {
    const providers = { ...(settings.authProviders as Record<string, Record<string, unknown>>) };
    for (const providerKey of Object.keys(providers)) {
      if (providers[providerKey]?.clientSecret) {
        providers[providerKey] = { ...providers[providerKey], clientSecret: '••••••••' };
      }
    }
    result.authProviders = providers;
  }
  // Never expose the encrypted SMTP password; signal whether one is set instead.
  if (settings.smtp && typeof settings.smtp === 'object' && !Array.isArray(settings.smtp)) {
    const smtp = { ...(settings.smtp as Record<string, unknown>) };
    const hasPass = !!smtp.pass;
    delete smtp.pass;
    smtp.hasPass = hasPass;
    result.smtp = smtp;
  }
  return result;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method === 'GET') {
    const settings = await getSettings();
    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }
    res.json(redactAuthSecrets({ ...settings }));
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
      smtp,
    } = req.body as {
      orgName?: unknown;
      orgLogo?: unknown;
      customerStatuses?: unknown;
      authProviders?: AuthProvidersInput;
      sessionMaxAge?: unknown;
      sessionIdleTimeout?: unknown;
      defaultLocale?: unknown;
      smtp?: SmtpInput;
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
      if (orgLogo !== null && typeof orgLogo !== 'string') {
        res.status(400).json({ error: 'orgLogo must be a string or null' });
        return;
      }
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

    if (smtp !== undefined) {
      if (typeof smtp !== 'object' || smtp === null || Array.isArray(smtp)) {
        res.status(400).json({ error: 'smtp must be an object' });
        return;
      }

      const existingSmtp =
        existing.smtp && typeof existing.smtp === 'object' && !Array.isArray(existing.smtp)
          ? (existing.smtp as Record<string, unknown>)
          : {};
      const next: Record<string, unknown> = { ...existingSmtp };

      if (smtp.enabled !== undefined) {
        if (typeof smtp.enabled !== 'boolean') {
          res.status(400).json({ error: 'smtp.enabled must be a boolean' });
          return;
        }
        next.enabled = smtp.enabled;
      }
      if (smtp.host !== undefined) {
        if (typeof smtp.host !== 'string') {
          res.status(400).json({ error: 'smtp.host must be a string' });
          return;
        }
        next.host = smtp.host.trim();
      }
      if (smtp.port !== undefined) {
        const port = typeof smtp.port === 'string' ? Number(smtp.port) : smtp.port;
        if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
          res.status(400).json({ error: 'smtp.port must be a valid port number' });
          return;
        }
        next.port = port;
      }
      if (smtp.secure !== undefined) {
        if (typeof smtp.secure !== 'boolean') {
          res.status(400).json({ error: 'smtp.secure must be a boolean' });
          return;
        }
        next.secure = smtp.secure;
      }
      if (smtp.user !== undefined) {
        if (typeof smtp.user !== 'string') {
          res.status(400).json({ error: 'smtp.user must be a string' });
          return;
        }
        next.user = smtp.user.trim();
      }
      if (smtp.from !== undefined) {
        if (typeof smtp.from !== 'string') {
          res.status(400).json({ error: 'smtp.from must be a string' });
          return;
        }
        next.from = smtp.from.trim();
      }
      // Encrypt the SMTP password at rest (reuses the OAuth-secret encryption helper).
      // A blank/undefined pass leaves the existing one untouched.
      if (smtp.pass !== undefined && smtp.pass !== '') {
        if (typeof smtp.pass !== 'string') {
          res.status(400).json({ error: 'smtp.pass must be a string' });
          return;
        }
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
          res.status(500).json({ error: 'NEXTAUTH_SECRET is not configured. Cannot encrypt SMTP credentials.' });
          return;
        }
        next.pass = encrypt(smtp.pass, secret);
      }

      updateData.smtp = next;
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
      // Strip OAuth client secrets and the SMTP password from the audit trail
      // (they are encrypted at rest but must not be persisted in audit logs).
      details: {
        before: redactAuthSecrets({ ...(existing as Record<string, unknown>) }),
        after: redactAuthSecrets({ ...(updated as Record<string, unknown>) }),
      },
    });

    logger.info({ fields: Object.keys(updateData) }, 'Settings updated');

    res.json(redactAuthSecrets({ ...updated }));
    return;
  }

  methodNotAllowed(res, ['GET', 'PUT']);
}

export default withAdmin(handler);
