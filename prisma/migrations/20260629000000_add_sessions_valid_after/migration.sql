-- AlterTable
-- Adds the per-user session-invalidation watermark. Any JWT whose issued snapshot
-- predates this value is rejected by the auth `jwt` callback (see lib/auth/options.ts),
-- which is how a password reset/change revokes all previously issued tokens.
ALTER TABLE "User" ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);
