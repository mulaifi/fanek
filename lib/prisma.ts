import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function parseEnvInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseEnvInt('DB_POOL_MAX', 10),
    idleTimeoutMillis: parseEnvInt('DB_POOL_IDLE_TIMEOUT', 30000),
    connectionTimeoutMillis: parseEnvInt('DB_POOL_CONNECT_TIMEOUT', 5000),
  });
  const adapter = new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
export default prisma;
