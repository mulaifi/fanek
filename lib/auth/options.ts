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

/**
 * Custom JWT claim name holding a millisecond-epoch snapshot of the user's
 * `sessionsValidAfter`, captured when the token was issued (at sign-in).
 *
 * We cannot reuse the JWT's own `iat` for this: NextAuth re-encodes the token on
 * every session read (jose `setIssuedAt()`), which refreshes `iat` to "now" each
 * request — a stolen token would keep renewing its `iat` and never appear stale.
 * `sva` is set once at sign-in and never refreshed, so it reliably records when the
 * token was minted relative to the user's last password change.
 */
const SVA_CLAIM = 'sva';

/** Coerce a Prisma `DateTime?` (or undefined) into a millisecond epoch, 0 when absent. */
function toEpochMs(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * A JWT is stale (must be invalidated) when the user's current `sessionsValidAfter`
 * is strictly newer than the snapshot captured in the token. This holds for any
 * token issued before the user's most recent password reset/change — including the
 * session that performed the change, so ALL sessions are invalidated (see the design
 * note in the PR). Tokens minted before this feature have no snapshot (treated as 0)
 * and stay valid until the next password change moves the watermark past 0.
 */
export function isSessionStale(tokenSva: unknown, dbSessionsValidAfter: Date | string | null): boolean {
  const tokenMs = typeof tokenSva === 'number' ? tokenSva : 0;
  return toEpochMs(dbSessionsValidAfter) > tokenMs;
}

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

        // Update last active. Non-critical and fire-and-forget: never block or fail
        // login on this write; just log if it errors.
        void prisma.user
          .update({
            where: { id: user.id },
            data: { lastActiveAt: new Date() },
          })
          .catch((err) => logger.warn({ err, userId: user.id }, 'Failed to update lastActiveAt'));

        // Return custom user shape; role and firstLogin are picked up by the jwt callback.
        // Cast through `unknown` then to `User` so NextAuth accepts it while preserving our fields.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firstLogin: user.firstLogin,
          locale: user.locale ?? null,
          passwordHash: user.passwordHash,
          // Snapshotted into the JWT (SVA_CLAIM) by the jwt callback so the token
          // records its issuance point relative to the user's last password change.
          sessionsValidAfter: user.sessionsValidAfter ?? null,
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
      maxAge: settings?.sessionMaxAge ?? 2592000,
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
    callbacks: {
      async jwt({ token, user, trigger, session }) {
        // On initial sign-in, user object is available with our custom fields
        if (user) {
          const u = user as {
            id: string;
            role: 'ADMIN' | 'EDITOR' | 'VIEWER';
            firstLogin?: boolean;
            sessionsValidAfter?: Date | string | null;
          };
          token.id = u.id;
          token.role = u.role;
          token.firstLogin = u.firstLogin;
          token.locale = (user as { locale?: string | null }).locale ?? null;
          token.hasPassword = !!(user as { passwordHash?: string | null }).passwordHash;
          // Snapshot the invalidation watermark at issuance. Never refreshed after this.
          token[SVA_CLAIM] = toEpochMs(u.sessionsValidAfter);
        } else if (token.id) {
          // Every subsequent session read (including client update() calls): re-check
          // the live watermark so a password reset/change revokes tokens in real time.
          // Throwing here makes NextAuth treat the session as invalid and clear the
          // cookie (getServerSession returns null) — the user is signed out.
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { sessionsValidAfter: true },
          });
          if (!dbUser) {
            throw new Error('Session invalidated: user no longer exists');
          }
          if (isSessionStale(token[SVA_CLAIM], dbUser.sessionsValidAfter)) {
            throw new Error('Session invalidated: password changed after this token was issued');
          }
        }
        // When update() is called from the client
        if (trigger === 'update' && session) {
          if (session.firstLogin !== undefined) token.firstLogin = session.firstLogin;
          if (session.name !== undefined) token.name = session.name;
          if (session.locale !== undefined) token.locale = session.locale;
        }
        return token;
      },
      async session({ session, token }) {
        if (token) {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.firstLogin = token.firstLogin;
          session.user.locale = (token.locale as string | null) ?? null;
          session.user.hasPassword = token.hasPassword;
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
