import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/localeServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  // Same resolution the server render uses, so the two can never disagree.
  return res.json({ locale: await resolveLocale(req) });
}
