import type { NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';

import { withAdmin, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { getSettings, invalidateSettingsCache } from '@/lib/settings';
import { encrypt } from '@/lib/encryption';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

interface ProviderUpdate {
  clientId?: string;
  clientSecret?: string;
  enabled?: boolean;
  allowedDomains?: string[];
}

interface SettingsUpdateBody {
  orgName?: string;
  orgLogo?: string | null;
  customerStatuses?: string[];
  authProviders?: {
    google?: ProviderUpdate;
    microsoft?: ProviderUpdate;
  };
  sessionMaxAge?: number;
  sessionIdleTimeout?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBody(body: unknown): SettingsUpdateBody {
  if (!isRecord(body)) return {};
  return body as SettingsUpdateBody;
}

function parseStatuses(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((status): status is string => typeof status === 'string');
}

function parseProviders(value: Prisma.JsonValue): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const settings = await getSettings();
    if (!settings) return res.status(404).json({ error: 'Settings not found' });
    return res.json(settings);
  }

  if (req.method === 'PUT') {
    const existing = await getSettings();
    if (!existing) return res.status(404).json({ error: 'Settings not found' });

    const {
      orgName,
      orgLogo,
      customerStatuses,
      authProviders,
      sessionMaxAge,
      sessionIdleTimeout,
    } = parseBody(req.body);

    const updateData: Prisma.SettingsUpdateInput = {};

    if (orgName !== undefined) {
      if (typeof orgName !== 'string' || orgName.trim() === '') {
        return res.status(400).json({ error: 'orgName must be a non-empty string' });
      }
      updateData.orgName = orgName.trim();
    }

    if (orgLogo !== undefined) {
      updateData.orgLogo = orgLogo;
    }

    if (customerStatuses !== undefined) {
      if (!Array.isArray(customerStatuses) || customerStatuses.length === 0) {
        return res.status(400).json({ error: 'customerStatuses must be a non-empty array' });
      }

      const currentStatuses = parseStatuses(existing.customerStatuses);
      const removedStatuses = currentStatuses.filter((status) => !customerStatuses.includes(status));

      for (const statusToRemove of removedStatuses) {
        const count = await prisma.customer.count({ where: { status: statusToRemove } });
        if (count > 0) {
          return res.status(400).json({
            error: `Cannot remove status "${statusToRemove}": ${count} customer(s) currently use this status`,
          });
        }
      }

      updateData.customerStatuses = customerStatuses;
    }

    if (authProviders !== undefined) {
      const providers = parseProviders(existing.authProviders);
      const secret = process.env.NEXTAUTH_SECRET ?? '';

      if (authProviders.google) {
        const currentGoogle = isRecord(providers.google) ? providers.google : {};
        const nextGoogle: Record<string, unknown> = { ...currentGoogle, ...authProviders.google };
        if (authProviders.google.clientSecret) {
          nextGoogle.clientSecret = encrypt(authProviders.google.clientSecret, secret);
        }
        providers.google = nextGoogle;
      }

      if (authProviders.microsoft) {
        const currentMicrosoft = isRecord(providers.microsoft) ? providers.microsoft : {};
        const nextMicrosoft: Record<string, unknown> = { ...currentMicrosoft, ...authProviders.microsoft };
        if (authProviders.microsoft.clientSecret) {
          nextMicrosoft.clientSecret = encrypt(authProviders.microsoft.clientSecret, secret);
        }
        providers.microsoft = nextMicrosoft;
      }

      updateData.authProviders = providers as Prisma.InputJsonValue;
    }

    if (sessionMaxAge !== undefined) {
      if (typeof sessionMaxAge !== 'number' || sessionMaxAge <= 0) {
        return res.status(400).json({ error: 'sessionMaxAge must be a positive number' });
      }
      updateData.sessionMaxAge = sessionMaxAge;
    }

    if (sessionIdleTimeout !== undefined) {
      if (typeof sessionIdleTimeout !== 'number' || sessionIdleTimeout <= 0) {
        return res.status(400).json({ error: 'sessionIdleTimeout must be a positive number' });
      }
      updateData.sessionIdleTimeout = sessionIdleTimeout;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
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

    return res.json(updated);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdmin(handler);
