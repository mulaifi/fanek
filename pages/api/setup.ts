import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { hashPassword, checkStrength } from '@/lib/password';
import { getSettings, invalidateSettingsCache } from '@/lib/settings';
import logger from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { templates } = require('../../prisma/seed') as { templates: Record<string, Array<Record<string, unknown>>> };

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!process.env.NEXTAUTH_SECRET) {
    res.status(500).json({ error: 'NEXTAUTH_SECRET is not set. See .env.example for instructions.' });
    return;
  }
  const existing = await getSettings();
  if (existing?.setupComplete) {
    res.status(400).json({ error: 'Setup already completed' });
    return;
  }
  const { admin, org, template } = req.body as {
    admin?: { name?: string; email?: string; password?: string };
    org?: { name?: string; logo?: string };
    template?: string;
  };
  if (!admin?.name || !admin?.email || !admin?.password) {
    res.status(400).json({ error: 'Admin name, email, and password are required' });
    return;
  }
  const strength = checkStrength(admin.password);
  if (!strength.valid) {
    res.status(400).json({ error: 'Weak password', details: strength.errors });
    return;
  }
  if (!org?.name) {
    res.status(400).json({ error: 'Organization name is required' });
    return;
  }
  try {
    const passwordHash = await hashPassword(admin.password);
    await prisma.$transaction(async (tx) => {
      await tx.settings.upsert({
        where: { id: 'default' },
        create: { id: 'default', orgName: org.name as string, orgLogo: org.logo ?? null, setupComplete: true },
        update: { orgName: org.name as string, orgLogo: org.logo ?? null, setupComplete: true },
      });
      await tx.user.create({
        data: { name: admin.name as string, email: (admin.email as string).toLowerCase().trim(), passwordHash, role: 'ADMIN', firstLogin: false },
      });
      if (template && templates[template]) {
        for (let i = 0; i < templates[template].length; i++) {
          const t = templates[template][i];
          await tx.serviceType.create({ data: { ...t, sortOrder: i } });
        }
      }
    });
    invalidateSettingsCache();
    logger.info({ email: admin.email, org: org.name, template }, 'Setup completed');
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Setup failed');
    if ((err as { code?: string }).code === 'P2002') {
      res.status(400).json({ error: 'A user with that email already exists' });
      return;
    }
    res.status(500).json({ error: 'Setup failed' });
  }
}
