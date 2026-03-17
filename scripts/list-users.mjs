#!/usr/bin/env node

/**
 * List all users in the database.
 *
 * Usage:
 *   node scripts/list-users.mjs
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany({
      select: { name: true, email: true, role: true, firstLogin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (users.length === 0) {
      console.log('No users found. Run the setup wizard to create the first admin.');
      return;
    }

    console.log(`\n  ${'Name'.padEnd(24)} ${'Email'.padEnd(30)} ${'Role'.padEnd(8)} ${'Status'.padEnd(12)} Created`);
    console.log(`  ${''.padEnd(24, '-')} ${''.padEnd(30, '-')} ${''.padEnd(8, '-')} ${''.padEnd(12, '-')} ${''.padEnd(12, '-')}`);

    for (const u of users) {
      const status = u.firstLogin ? 'Pending' : 'Active';
      const date = u.createdAt.toISOString().split('T')[0];
      console.log(`  ${(u.name || '').padEnd(24)} ${u.email.padEnd(30)} ${u.role.padEnd(8)} ${status.padEnd(12)} ${date}`);
    }

    console.log(`\n  Total: ${users.length} user(s)\n`);
  } catch (err) {
    console.error('Failed to list users:', err.message);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (_) { /* ignore */ }
    try { await pool.end(); } catch (_) { /* ignore */ }
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});
