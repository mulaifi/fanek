// @ts-nocheck
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

config();

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async adapter(env: (name: string) => string) {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: env('DATABASE_URL') });
      return new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]);
    },
  },
});
