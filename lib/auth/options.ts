import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { AuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { getSettings } from '@/lib/settings';
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/logger';
import type { Role } from '@/types';

interface GoogleProviderSettings {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  allowedDomains?: string[];
}

interface ParsedAuthProviders {
  google?: GoogleProviderSettings;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAuthProviders(value: unknown): ParsedAuthProviders {
  if (!isRecord(value)) return {};

  const providers: ParsedAuthProviders = {};
  const google = value.google;
  if (isRecord(google)) {
    providers.google = {
      enabled: typeof google.enabled === 'boolean' ? google.enabled : false,
      clientId: typeof google.clientId === 'string' ? google.clientId : undefined,
      clientSecret: typeof google.clientSecret === 'string' ? google.clientSecret : undefined,
      allowedDomains: Array.isArray(google.allowedDomains)
        ? google.allowedDomains.filter((domain): domain is string => typeof domain === 'string')
        : undefined,
    };
  }

  return providers;
}

function hasOAuthConfig(google: GoogleProviderSettings | undefined): google is Required<Pick<GoogleProviderSettings, 'clientId' | 'clientSecret'>> & GoogleProviderSettings {
  return Boolean(google?.enabled && google.clientId && google.clientSecret);
}

export async function getAuthOptions(): Promise<AuthOptions> {
  const settings = await getSettings();
  const authProviders = parseAuthProviders(settings?.authProviders);
  const sessionMaxAge = typeof settings?.sessionMaxAge === 'number' ? settings.sessionMaxAge : 2592000;

  const providers: AuthOptions['providers'] = [
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

        const authUser: NextAuthUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firstLogin: user.firstLogin,
        };
        return authUser;
      },
    }),
  ];

  // Add Google OAuth if configured
  if (hasOAuthConfig(authProviders.google)) {
    const google = authProviders.google;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error('NEXTAUTH_SECRET is required when Google OAuth is enabled');
    }
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

  const options: AuthOptions = {
    providers,
    session: {
      strategy: 'jwt',
      maxAge: sessionMaxAge,
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
          token.role = user.role as Role;
          token.firstLogin = user.firstLogin as boolean;
        }
        // When update() is called from the client
        if (trigger === 'update' && session) {
          if (session.firstLogin !== undefined) token.firstLogin = session.firstLogin;
          if (session.name !== undefined) token.name = session.name;
        }
        return token;
      },
      async session({ session, token }) {
        if (token && session.user) {
          if (typeof token.id === 'string') {
            session.user.id = token.id;
          }
          if (token.role) {
            session.user.role = token.role;
          }
          session.user.firstLogin = Boolean(token.firstLogin);
        }
        return session;
      },
      async signIn({ user, account }) {
        // For OAuth sign-ins, check domain restrictions
        if (account?.provider === 'google') {
          const currentSettings = await getSettings();
          const google = parseAuthProviders(currentSettings?.authProviders).google;
          const allowedDomains = google?.allowedDomains;
          if (Array.isArray(allowedDomains) && allowedDomains.length > 0) {
            const domain = user.email?.split('@')[1];
            if (!domain || !allowedDomains.includes(domain)) {
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

  if (hasOAuthProviders) {
    options.adapter = PrismaAdapter(prisma);
  }

  return options;
}
