import type { CipherModule, LeaderboardEntry, LeaderboardModule } from '@shiftcrack/shared';
import { LeaderboardModule as LEADERBOARD_MODULES } from '@shiftcrack/shared';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prisma/client.js';

/**
 * Hall of Fame (SDD Phase 8), materialized best-of design:
 *
 * Every SOLVED session upserts the player's personal best into the
 * `Leaderboard` table (one row per user × module), so GET /leaderboards is
 * a single indexed top-N query instead of a full GameSession scan ranked in
 * memory. Ranking contract (per spec):
 *   1. fewest hints used (hintsUsed ASC);
 *   2. shortest solve time (timeSpentMs ASC);
 *   3. earliest solve timestamp (solvedAt ASC) as a stable tie-break.
 *
 * Only the two competitive missions (FREQUENCY, VIGENERE — the shared
 * `LeaderboardModule` contract) are ever recorded or read.
 */

/** Hall of Fame length (the board is cut to this many entries). */
export const LEADERBOARD_LIMIT = 50;

const COMPETITIVE_MODULES: ReadonlySet<string> = new Set<string>(Object.values(LEADERBOARD_MODULES));

/** Solve time in whole milliseconds; clamped at 0 for clock skew safety. */
export function timeSpentMs(startedAt: Date, solvedAt: Date): number {
  return Math.max(0, solvedAt.getTime() - startedAt.getTime());
}

/**
 * Ranking comparator: hints ascending, then solve time ascending, then the
 * solve timestamp as a stable tie-break. Exported so the exact ranking
 * contract is unit-testable independently of the database.
 */
export function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.hintsUsed !== b.hintsUsed) return a.hintsUsed - b.hintsUsed;
  if (a.timeSpent !== b.timeSpent) return a.timeSpent - b.timeSpent;
  return a.solvedAt < b.solvedAt ? -1 : a.solvedAt > b.solvedAt ? 1 : 0;
}

export interface LeaderboardWriteInput {
  userId: string;
  module: CipherModule;
  hintsUsed: number;
  timeSpentMs: number;
  solvedAt: Date;
}

/** Prisma filter matching every stored row this new solve is strictly better than. */
function betterThanFilter(input: LeaderboardWriteInput): Prisma.LeaderboardWhereInput {
  const { userId, module, hintsUsed, timeSpentMs, solvedAt } = input;
  return {
    userId,
    module,
    OR: [
      { hintsUsed: { gt: hintsUsed } },
      { hintsUsed, timeSpentMs: { gt: timeSpentMs } },
      { hintsUsed, timeSpentMs, solvedAt: { gt: solvedAt } },
    ],
  };
}

/**
 * Race-safe "upsert only if better" (SDD Phase 8 optimization): called on
 * every SOLVED session for the competitive modules.
 *
 * The conditional UPDATE takes the row lock and re-evaluates its WHERE
 * against the latest committed version, so two concurrent solves by the
 * same player can never downgrade the stored best. When no row exists yet
 * the UPDATE matches nothing and the INSERT runs; a P2002 from a racing
 * writer makes the UPDATE retry against the row that writer inserted.
 */
export async function recordLeaderboardEntry(input: LeaderboardWriteInput): Promise<void> {
  if (!COMPETITIVE_MODULES.has(input.module)) return;

  const data = {
    hintsUsed: input.hintsUsed,
    timeSpentMs: input.timeSpentMs,
    solvedAt: input.solvedAt,
  };
  const where = betterThanFilter(input);

  const updated = await prisma.leaderboard.updateMany({ where, data });
  if (updated.count > 0) return;

  try {
    await prisma.leaderboard.create({ data: { ...data, userId: input.userId, module: input.module } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    await prisma.leaderboard.updateMany({ where, data });
  }
}

/** GET /leaderboards — top-N personal bests for one competitive module. */
export async function getLeaderboard(module: LeaderboardModule): Promise<LeaderboardEntry[]> {
  const rows = await prisma.leaderboard.findMany({
    where: {
      module,
      // Anonymous solves have no nickname and are not ranked.
      user: { nickname: { not: null } },
    },
    orderBy: [{ hintsUsed: 'asc' }, { timeSpentMs: 'asc' }, { solvedAt: 'asc' }],
    take: LEADERBOARD_LIMIT,
    select: {
      hintsUsed: true,
      timeSpentMs: true,
      solvedAt: true,
      user: { select: { nickname: true } },
    },
  });

  return rows.map((row) => ({
    nickname: row.user.nickname!,
    timeSpent: row.timeSpentMs,
    hintsUsed: row.hintsUsed,
    solvedAt: row.solvedAt.toISOString(),
  }));
}
