import type { NextApiResponse } from 'next';
import type { Role } from '@prisma/client';

import { withAdmin, type AuthenticatedRequest } from '@/lib/auth/guard';
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

const VALID_ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

interface CreateUserBody {
  name?: string;
  email?: string;
  role?: Role;
}

function isUniqueConstraintError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ data: users });
  }

  if (req.method === 'POST') {
    const { name, email, role } = (req.body ?? {}) as CreateUserBody;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Validation failed', details: { name: 'Name is required' } });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Validation failed', details: { email: 'Valid email is required' } });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    try {
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash,
          role: role ?? 'VIEWER',
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

      return res.status(201).json({ user, tempPassword });
    } catch (err) {
      if (isUniqueConstraintError(err) && err.code === 'P2002') {
        return res.status(409).json({ error: 'A user with that email already exists' });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdmin(handler);
