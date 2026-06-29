import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAuth, methodNotAllowed } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// Fields of the User record that are safe to hand back to the user. Deliberately
// EXCLUDES `passwordHash` (credential) and `sessionsValidAfter` (an internal
// session-invalidation watermark, not the user's personal data). Password-reset
// tokens are never exported either — they live in a separate table and contain
// only opaque hashes.
const SELF_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  firstLogin: true,
  lastActiveAt: true,
  locale: true,
  image: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * GET /api/profile/export — GDPR Art. 20 (data portability).
 *
 * Returns the *requesting user's own* personal data as a downloadable JSON file:
 * their account record (sans credentials) plus the audit-log entries attributed to
 * them. Organization data (customers, partners, services) is NOT personal data of
 * the requester and is intentionally excluded.
 *
 * The audit entries deliberately OMIT the `details` column: it stores `{ before,
 * after }` snapshots that can contain organization data (e.g. customer/partner
 * field values), which is not the requesting user's personal data. Only the action
 * metadata (action, resource, resourceId, timestamp) is exported.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const userId = req.session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SELF_USER_SELECT,
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { userId },
    // `details` is intentionally excluded — it can hold org-data snapshots (see the
    // doc comment above). Only action metadata is the requesting user's own data.
    select: {
      id: true,
      action: true,
      resource: true,
      resourceId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    auditLogs,
  };

  // Record that the export happened. This audit entry references the still-existing
  // requesting user, so the FK is satisfied.
  await logAudit({
    userId,
    action: 'EXPORT',
    resource: 'user',
    resourceId: userId,
    details: { auditLogCount: auditLogs.length },
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="fanek-my-data.json"');
  // This response is a personal-data (PII) download — never cache it anywhere.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send(JSON.stringify(payload, null, 2));
}

export default withAuth(handler);
