import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed } from '@/lib/auth/guard';
import { version } from '../../package.json';

// Public liveness probe for container orchestrators. Intentionally dependency-free
// (no DB call) so it stays fast and reports the process as up even if downstreams fail.
export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), version });
}
