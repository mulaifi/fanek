import { getServerSession } from 'next-auth/next';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types/index';
import { getAuthOptions } from '@/lib/auth/options';
import { getSettings } from '@/lib/settings';
import logger from '@/lib/logger';

type AuthenticatedHandler = (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void | NextApiResponse>;
type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void | NextApiResponse>;

export function methodNotAllowed(res: NextApiResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ error: 'Method not allowed' });
}

export function withAuth(handler: AuthenticatedHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
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
      return await handler(req as AuthenticatedRequest, res);
    } catch (err) {
      logger.error({ err, method: req.method, url: req.url }, 'Unhandled API error');
      if (!res.headersSent) {
        return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
      }
    }
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
