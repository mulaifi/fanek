import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin } from '@/lib/auth/guard';
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

const VALID_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'] as const;

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const id = req.query.id as string;

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
    return;
  }

  if (req.method === 'PUT') {
    const { role } = req.body as { role?: unknown };

    if (!role || typeof role !== 'string' || !(VALID_ROLES as readonly string[]).includes(role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: role as 'ADMIN' | 'EDITOR' | 'VIEWER' },
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

    res.json(updated);
    return;
  }

  if (req.method === 'DELETE') {
    if (req.session.user.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.user.delete({ where: { id } });

    await logAudit({
      userId: req.session.user.id,
      action: 'DELETE',
      resource: 'user',
      resourceId: id,
      details: { before: existing },
    });

    logger.info({ userId: id }, 'User deleted');

    res.json({ success: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

export default withAdmin(handler);
