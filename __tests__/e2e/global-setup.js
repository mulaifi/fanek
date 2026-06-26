// Truncates the database to a clean, migrated state before the suite runs so the
// setup-wizard spec can drive a genuine first-run flow. Migrations are expected to
// have already been applied (npm run db:migrate). Idempotent and safe to re-run.
require('dotenv').config();
const { Pool } = require('pg');

// Guard against the destructive TRUNCATE ever running on a non-test database.
// Allowed when: a local host, OR the DB name looks like a test DB, OR explicitly
// forced. Refused outright under NODE_ENV=production unless forced.
function assertSafeToReset(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('[e2e] DATABASE_URL is missing or invalid; refusing to reset the database.');
  }
  const host = url.hostname;
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const forced = process.env.E2E_ALLOW_DB_RESET === 'true' || process.env.E2E_ALLOW_DB_RESET === '1';
  const isLocal = ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host);
  const looksTest = /test/i.test(dbName);

  if (process.env.NODE_ENV === 'production' && !forced) {
    throw new Error(
      `[e2e] Refusing to TRUNCATE: NODE_ENV=production (db="${dbName}"). Set E2E_ALLOW_DB_RESET=1 to override.`
    );
  }
  if (!isLocal && !looksTest && !forced) {
    throw new Error(
      `[e2e] Refusing to TRUNCATE non-local, non-test database (host="${host}", db="${dbName}"). ` +
        'Point DATABASE_URL at a test database or set E2E_ALLOW_DB_RESET=1 to override.'
    );
  }
}

module.exports = async function globalSetup() {
  assertSafeToReset(process.env.DATABASE_URL);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`
    );
    const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
    if (tables) {
      await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
    }
    console.log(`[e2e] Database reset: truncated ${rows.length} table(s).`);
  } finally {
    await pool.end();
  }

  // The app caches settings in-process for 30s. A long-running (reused) dev server
  // may still report setupComplete=true from before the truncate, which makes the
  // setup-wizard spec fail. Wait until the server observes the clean state.
  const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const deadline = Date.now() + 40000;
  let observed = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/settings`, { signal: AbortSignal.timeout(5000) });
      if (res.ok && (await res.json()).setupComplete === false) {
        observed = true;
        break;
      }
    } catch {
      /* server not up yet, or request timed out */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!observed) {
    console.warn('[e2e] server still reports setupComplete=true after wait; setup spec may fail');
  }
};
