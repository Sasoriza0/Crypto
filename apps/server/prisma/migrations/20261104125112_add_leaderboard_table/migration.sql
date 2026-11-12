-- CreateTable
CREATE TABLE "Leaderboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "CipherModule" NOT NULL,
    "hintsUsed" INTEGER NOT NULL,
    "timeSpentMs" INTEGER NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Leaderboard_module_hintsUsed_timeSpentMs_solvedAt_idx" ON "Leaderboard"("module", "hintsUsed", "timeSpentMs", "solvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_userId_module_key" ON "Leaderboard"("userId", "module");

-- AddForeignKey
ALTER TABLE "Leaderboard" ADD CONSTRAINT "Leaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
