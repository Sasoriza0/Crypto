-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "contextClue" TEXT,
ADD COLUMN     "contextUsed" BOOLEAN NOT NULL DEFAULT false;
