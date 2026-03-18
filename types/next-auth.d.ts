import type { DefaultSession } from 'next-auth';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: Role;
      firstLogin: boolean;
    };
  }

  interface User {
    id: string;
    role: Role;
    firstLogin: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: Role;
    firstLogin?: boolean;
  }
}
