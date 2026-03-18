import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import { getSettings } from '@/lib/settings';

export default function Home() {
  return null;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const settings = await getSettings();
  if (!settings?.setupComplete) {
    return { redirect: { destination: '/setup', permanent: false } };
  }
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { redirect: { destination: '/dashboard', permanent: false } };
}
