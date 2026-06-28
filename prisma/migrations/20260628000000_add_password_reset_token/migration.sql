-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "smtp" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
-- Partial unique index: at most one ACTIVE (unused) reset token per user. This is
-- the DB-level guarantee behind the single-active-token invariant; a concurrent
-- second create raises a P2002 unique violation (handled in lib/passwordReset.ts).
-- Prisma's schema language cannot express a partial filter (WHERE), so this index
-- lives only in this migration; see the note on the PasswordResetToken model.
CREATE UNIQUE INDEX "PasswordResetToken_one_active_per_user_key" ON "PasswordResetToken"("userId") WHERE "usedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
