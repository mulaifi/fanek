import { getServerSession } from 'next-auth/next';
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { Session } from 'next-auth';
import { getAuthOptions } from '@/lib/auth/options';
import { getSettings } from '@/lib/settings';
import type { ApiError } from '@/types';

export type AuthenticatedRequest = NextApiRequest & { session: Session };
type ApiHandler<T = unknown> = (req: AuthenticatedRequest, res: NextApiResponse<T | ApiError>) => Promise<unknown>;

export function withAuth<T = unknown>(handler: ApiHandler<T>): NextApiHandler<T | ApiError> {
  return async (req, res) => {
    // Check if setup is complete
    const settings = await getSettings();
    if (!settings?.setupComplete) {
      return res.status(503).json({ error: 'Setup not complete' });
    }

    const options = await getAuthOptions();
    const session = await getServerSession(req, res, options);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!session.user?.id || !session.user?.role) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    (req as AuthenticatedRequest).session = session;
    return handler(req as AuthenticatedRequest, res);
  };
}

export function withAdmin<T = unknown>(handler: ApiHandler<T>): NextApiHandler<T | ApiError> {
  return withAuth(async (req, res) => {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    return handler(req, res);
  });
}

export function withEditor<T = unknown>(handler: ApiHandler<T>): NextApiHandler<T | ApiError> {
  return withAuth(async (req, res) => {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    return handler(req, res);
  });
}
