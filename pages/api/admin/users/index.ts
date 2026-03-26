import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { generateTempPassword, hashPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';
import logger from '@/lib/logger';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  firstLogin: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const VALID_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'] as const;

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method === 'GET') {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: users });
    return;
  }

  if (req.method === 'POST') {
    const { name, email, role } = req.body as { name?: unknown; email?: unknown; role?: unknown };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Validation failed', details: { name: 'Name is required' } });
      return;
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Validation failed', details: { email: 'Valid email is required' } });
      return;
    }
    if (role && (typeof role !== 'string' || !(VALID_ROLES as readonly string[]).includes(role))) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    try {
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash,
          role: (typeof role === 'string' ? role : 'VIEWER') as 'ADMIN' | 'EDITOR' | 'VIEWER',
          firstLogin: true,
        },
        select: USER_SELECT,
      });

      await logAudit({
        userId: req.session.user.id,
        action: 'CREATE',
        resource: 'user',
        resourceId: user.id,
        details: { after: { ...user } },
      });

      logger.info({ userId: user.id }, 'User created (invite)');

      res.status(201).json({ user, tempPassword });
      return;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        res.status(409).json({ error: 'A user with that email already exists' });
        return;
      }
      throw err;
    }
  }

  methodNotAllowed(res, ['GET', 'POST']);
}

export default withAdmin(handler);
