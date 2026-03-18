import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions, User } from 'next-auth';
import type { Provider } from 'next-auth/providers/index';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { getSettings } from '@/lib/settings';
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/logger';

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const settings = await getSettings();
  // authProviders is JsonValue from Prisma; cast for safe access
  const authProviders = settings?.authProviders as Record<string, Record<string, unknown>> | null;

  const providers: Provider[] = [
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

        // Return custom user shape; role and firstLogin are picked up by the jwt callback.
        // Cast through `unknown` then to `User` so NextAuth accepts it while preserving our fields.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firstLogin: user.firstLogin,
        } as unknown as User;
      },
    }),
  ];

  // Add Google OAuth if configured
  if (authProviders?.google?.enabled) {
    const google = authProviders.google;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is required for OAuth providers');
    providers.push(
      GoogleProvider({
        clientId: google.clientId as string,
        clientSecret: decrypt(google.clientSecret as string, secret),
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
      strategy: 'jwt' as const,
      maxAge: settings?.sessionMaxAge || 2592000,
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
    callbacks: {
      async jwt({ token, user, trigger, session }) {
        // On initial sign-in, user object is available with our custom fields
        if (user) {
          const u = user as { id: string; role: 'ADMIN' | 'EDITOR' | 'VIEWER'; firstLogin?: boolean };
          token.id = u.id;
          token.role = u.role;
          token.firstLogin = u.firstLogin;
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
          const authProviders = settings?.authProviders as Record<string, Record<string, unknown>> | null;
          const google = authProviders?.google;
          const allowedDomains = google?.allowedDomains as string[] | undefined;
          if (allowedDomains && allowedDomains.length > 0) {
            const domain = user.email?.split('@')[1];
            if (!allowedDomains.includes(domain ?? '')) {
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
