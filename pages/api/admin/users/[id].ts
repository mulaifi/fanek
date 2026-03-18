import type { NextApiResponse } from 'next';
import type { Role } from '@prisma/client';

import { withAdmin, type AuthenticatedRequest } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
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

function asQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = asQueryString(req.query.id);
  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  }

  if (req.method === 'PUT') {
    const role = (req.body as { role?: Role } | null)?.role;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: USER_SELECT,
    });

    await logAudit({
      userId: req.session.user.id,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id,
      details: { before: { role: existing.role }, after: { role: updated.role } },
    });

    logger.info({ userId: id, role }, 'User role updated');

    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    if (req.session.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    await prisma.user.delete({ where: { id } });

    await logAudit({
      userId: req.session.user.id,
      action: 'DELETE',
      resource: 'user',
      resourceId: id,
      details: { before: existing },
    });

    logger.info({ userId: id }, 'User deleted');

    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdmin(handler);
