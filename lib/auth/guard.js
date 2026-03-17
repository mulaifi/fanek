import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth/options';
import { getSettings } from '@/lib/settings';

export function withAuth(handler) {
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
    req.session = session;
    return handler(req, res);
  };
}

export function withAdmin(handler) {
  return withAuth(async (req, res) => {
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    return handler(req, res);
  });
}

export function withEditor(handler) {
  return withAuth(async (req, res) => {
    if (!['ADMIN', 'EDITOR'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Editor access required' });
    }
    return handler(req, res);
  });
}
