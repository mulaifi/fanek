import prisma from '@/lib/prisma';
import { hashPassword, checkStrength } from '@/lib/password';
import { getSettings, invalidateSettingsCache } from '@/lib/settings';
import logger from '@/lib/logger';

const { templates } = require('../../prisma/seed');

export default async function handler(req, res) {
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
  const { admin, org, template } = req.body;
  if (!admin?.name || !admin?.email || !admin?.password) {
    return res.status(400).json({ error: 'Admin name, email, and password are required' });
  }
  const strength = checkStrength(admin.password);
  if (!strength.valid) {
    return res.status(400).json({ error: 'Weak password', details: strength.errors });
  }
  if (!org?.name) {
    return res.status(400).json({ error: 'Organization name is required' });
  }
  try {
    const passwordHash = await hashPassword(admin.password);
    await prisma.$transaction(async (tx) => {
      await tx.settings.upsert({
        where: { id: 'default' },
        create: { id: 'default', orgName: org.name, orgLogo: org.logo || null, setupComplete: true },
        update: { orgName: org.name, orgLogo: org.logo || null, setupComplete: true },
      });
      await tx.user.create({
        data: { name: admin.name, email: admin.email.toLowerCase().trim(), passwordHash, role: 'ADMIN', firstLogin: false },
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
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Setup failed');
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A user with that email already exists' });
    }
    return res.status(500).json({ error: 'Setup failed' });
  }
}
