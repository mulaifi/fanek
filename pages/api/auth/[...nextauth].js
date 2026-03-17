import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth/options';

export default async function auth(req, res) {
  const options = await getAuthOptions();
  return NextAuth(req, res, options);
}
