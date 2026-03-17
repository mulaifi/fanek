import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { getSettings } from '@/lib/settings';
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/logger';

export async function getAuthOptions() {
  const settings = await getSettings();
  const providers = [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Update last active
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        }).catch(() => {});

        return { id: user.id, name: user.name, email: user.email, role: user.role, firstLogin: user.firstLogin };
      },
    }),
  ];

  // Add Google OAuth if configured
  if (settings?.authProviders?.google?.enabled) {
    const google = settings.authProviders.google;
    const secret = process.env.NEXTAUTH_SECRET;
    providers.push(
      GoogleProvider({
        clientId: google.clientId,
        clientSecret: decrypt(google.clientSecret, secret),
      })
    );
  }

  // Only use adapter for OAuth providers (handles user creation).
  // With JWT strategy + CredentialsProvider, adapter causes conflicts.
  const hasOAuthProviders = providers.length > 1;

  return {
    ...(hasOAuthProviders && { adapter: PrismaAdapter(prisma) }),
    providers,
    session: {
      strategy: 'jwt',
      maxAge: settings?.sessionMaxAge || 2592000,
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
    callbacks: {
      async jwt({ token, user, trigger, session }) {
        // On initial sign-in, user object is available
        if (user) {
          token.id = user.id;
          token.role = user.role;
          token.firstLogin = user.firstLogin;
        }
        // When update() is called from the client
        if (trigger === 'update' && session) {
          if (session.firstLogin !== undefined) token.firstLogin = session.firstLogin;
          if (session.name !== undefined) token.name = session.name;
        }
        return token;
      },
      async session({ session, token }) {
        if (token) {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.firstLogin = token.firstLogin;
        }
        return session;
      },
      async signIn({ user, account }) {
        // For OAuth sign-ins, check domain restrictions
        if (account?.provider === 'google') {
          const settings = await getSettings();
          const google = settings?.authProviders?.google;
          if (google?.allowedDomains?.length > 0) {
            const domain = user.email?.split('@')[1];
            if (!google.allowedDomains.includes(domain)) {
              logger.warn({ email: user.email }, 'OAuth sign-in blocked: domain not allowed');
              return false;
            }
          }
          // Check if user exists; new OAuth users will be created by the adapter
          // with VIEWER role (default). No manual role assignment needed.
        }
        return true;
      },
    },
  };
}
