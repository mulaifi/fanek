#!/usr/bin/env node

/**
 * Reset a user's password directly in the database.
 *
 * Usage:
 *   node scripts/reset-password.mjs <email>
 *   node scripts/reset-password.mjs <email> --password <new-password>
 *
 * If --password is omitted, a random 16-character password is generated.
 * The user will be required to change it on next login (firstLogin = true).
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const SALT_ROUNDS = 12;

function generatePassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/reset-password.mjs <email> [--password <new-password>]

Options:
  --password <pw>   Set a specific password (otherwise random is generated)
  --help            Show this help message

Examples:
  node scripts/reset-password.mjs admin@example.com
  node scripts/reset-password.mjs admin@example.com --password MyNewPass123!
`);
    process.exit(0);
  }

  const pwFlagIndex = args.indexOf('--password');
  const explicitPassword = pwFlagIndex !== -1 ? args[pwFlagIndex + 1] : null;
  const email = args.find((a, i) => !a.startsWith('--') && (i === 0 || args[i - 1] !== '--password'));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Error: Please provide a valid email address as the first argument.');
    process.exit(1);
  }

  if (pwFlagIndex !== -1 && !explicitPassword) {
    console.error('Error: --password flag requires a value');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.error(`Error: No user found with email "${email}"`);
      if (args.includes('--verbose')) {
        const users = await prisma.user.findMany({ select: { email: true, role: true } });
        if (users.length > 0) {
          console.log('\nExisting users:');
          users.forEach((u) => console.log(`  ${u.email} (${u.role})`));
        }
      } else {
        console.log('Hint: use --verbose to list existing users.');
      }
      process.exit(1);
    }

    const newPassword = explicitPassword || generatePassword();
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hash,
        firstLogin: !explicitPassword, // force change if random password
      },
    });

    console.log(`\nPassword reset for: ${user.name} <${email}> (${user.role})`);
    console.log(`New password: ${newPassword}`);
    if (!explicitPassword) {
      console.log('User will be asked to change this password on next login.');
    }
    console.log('');
  } catch (err) {
    console.error('Failed to reset password:', err.message);
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
