import { getServerSession } from 'next-auth/next';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types/index';
import { getAuthOptions } from '@/lib/auth/options';
import { getSettings } from '@/lib/settings';

type AuthenticatedHandler = (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void | NextApiResponse>;
type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void | NextApiResponse>;

export function withAuth(handler: AuthenticatedHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
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
    (req as AuthenticatedRequest).session = session;
    return handler(req as AuthenticatedRequest, res);
  };
}

export function withAdmin(handler: AuthenticatedHandler): ApiHandler {
  return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    return handler(req, res);
  });
}

export function withEditor(handler: AuthenticatedHandler): ApiHandler {
  return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    return handler(req, res);
  });
}
