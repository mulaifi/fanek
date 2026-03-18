import NextAuth from 'next-auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthOptions } from '@/lib/auth/options';

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const options = await getAuthOptions();
  return NextAuth(req, res, options);
}
