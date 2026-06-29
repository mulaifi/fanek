import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'EDITOR' | 'VIEWER';
      firstLogin?: boolean;
      locale: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'ADMIN' | 'EDITOR' | 'VIEWER';
    firstLogin?: boolean;
    locale: string | null;
    /**
     * Millisecond-epoch snapshot of the user's `sessionsValidAfter` captured when the
     * token was issued (at sign-in). Compared against the live DB value on every
     * session read to revoke tokens issued before a password reset/change.
     */
    sva?: number;
  }
}
