import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import { hashPassword, checkStrength } from '@/lib/password';
import { getSettings, invalidateSettingsCache } from '@/lib/settings';
import logger from '@/lib/logger';
import { templates } from '../../prisma/seed';

interface SetupBody {
  admin?: {
    name?: string;
    email?: string;
    password?: string;
  };
  org?: {
    name?: string;
    logo?: string | null;
  };
  template?: keyof typeof templates;
}

function isKnownPrismaError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.NEXTAUTH_SECRET) {
    return res.status(500).json({ error: 'NEXTAUTH_SECRET is not set. See .env.example for instructions.' });
  }
  const existing = await getSettings();
  if (existing?.setupComplete) {
    return res.status(400).json({ error: 'Setup already completed' });
  }
  const { admin, org, template } = (req.body ?? {}) as SetupBody;
  if (!admin?.name || !admin?.email || !admin?.password) {
    return res.status(400).json({ error: 'Admin name, email, and password are required' });
  }
  const adminName = admin.name;
  const adminEmail = admin.email;
  const adminPassword = admin.password;

  const strength = checkStrength(adminPassword);
  if (!strength.valid) {
    return res.status(400).json({ error: 'Weak password', details: strength.errors });
  }
  if (!org?.name) {
    return res.status(400).json({ error: 'Organization name is required' });
  }
  const orgName = org.name;
  const orgLogo = org.logo || null;
  try {
    const passwordHash = await hashPassword(adminPassword);
    await prisma.$transaction(async (tx) => {
      await tx.settings.upsert({
        where: { id: 'default' },
        create: { id: 'default', orgName, orgLogo, setupComplete: true },
        update: { orgName, orgLogo, setupComplete: true },
      });
      await tx.user.create({
        data: { name: adminName, email: adminEmail.toLowerCase().trim(), passwordHash, role: 'ADMIN', firstLogin: false },
      });
      if (template && templates[template]) {
        const templateTypes = templates[template];
        for (let index = 0; index < templateTypes.length; index += 1) {
          const type = templateTypes[index];
          await tx.serviceType.create({
            data: {
              ...(type as Omit<Prisma.ServiceTypeCreateInput, 'sortOrder'>),
              sortOrder: index,
            },
          });
        }
      }
    });
    invalidateSettingsCache();
    logger.info({ email: adminEmail, org: orgName, template }, 'Setup completed');
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Setup failed');
    if (isKnownPrismaError(err) && err.code === 'P2002') {
      return res.status(400).json({ error: 'A user with that email already exists' });
    }
    return res.status(500).json({ error: 'Setup failed' });
  }
}
