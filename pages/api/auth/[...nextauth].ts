import type { NextApiRequest, NextApiResponse } from 'next';
import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth/options';

export default async function auth(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const options = await getAuthOptions();
  return NextAuth(req, res, options);
}
