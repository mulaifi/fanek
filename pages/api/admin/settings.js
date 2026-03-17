import { withAdmin } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { getSettings, invalidateSettingsCache } from '@/lib/settings';
import { encrypt } from '@/lib/encryption';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

async function handler(req, res) {
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
    } = req.body;

    const updateData = {};

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

      // Check for statuses being removed
      const currentStatuses = existing.customerStatuses || [];
      const removedStatuses = currentStatuses.filter((s) => !customerStatuses.includes(s));

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
      const providers = { ...(existing.authProviders || {}) };

      if (authProviders.google) {
        providers.google = { ...providers.google, ...authProviders.google };
        // Encrypt clientSecret if being set
        if (authProviders.google.clientSecret) {
          providers.google.clientSecret = encrypt(
            authProviders.google.clientSecret,
            process.env.NEXTAUTH_SECRET
          );
        }
      }

      if (authProviders.microsoft) {
        providers.microsoft = { ...providers.microsoft, ...authProviders.microsoft };
        if (authProviders.microsoft.clientSecret) {
          providers.microsoft.clientSecret = encrypt(
            authProviders.microsoft.clientSecret,
            process.env.NEXTAUTH_SECRET
          );
        }
      }

      updateData.authProviders = providers;
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
