import type { LeaderboardEntry, LeaderboardModule } from '@shiftcrack/shared';
import { prisma } from '../prisma/client.js';

/**
 * Hall of Fame (SDD Phase 8): ranks SOLVED sessions of the two competitive
 * missions — FREQUENCY and VIGENERE — and joins the player's nickname.
 *
 * Ranking (per spec):
 *   1. fewest hints used (hintsUsed ASC);
 *   2. shortest solve time (solvedAt - startedAt ASC).
 *
 * Prisma cannot order by the computed `solvedAt - startedAt` expression, so
 * the candidate rows are fetched and ranked in JS. Each player contributes
 * ONE entry — their personal best (fewest hints, then fastest), so a single
 * operator can never flood the board with repeat solves.
 */

/** Hall of Fame length (the board is cut to this many entries). */
export const LEADERBOARD_LIMIT = 50;

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

/** A solved session row as fetched from the DB (nickname joined from User). */
export interface SolvedSessionRow {
  nickname: string;
  hintsUsed: number;
  startedAt: Date;
  solvedAt: Date;
}

function toEntry(row: SolvedSessionRow): LeaderboardEntry {
  return {
    nickname: row.nickname,
    timeSpent: timeSpentMs(row.startedAt, row.solvedAt),
    hintsUsed: row.hintsUsed,
    solvedAt: row.solvedAt.toISOString(),
  };
}

/**
 * Pure ranking pipeline: map rows to entries, keep each player's personal
 * best, sort by the ranking contract, cut to the board limit. Exported for
 * direct unit tests — the DB fetch is the only impure step.
 */
export function buildLeaderboard(rows: SolvedSessionRow[], limit = LEADERBOARD_LIMIT): LeaderboardEntry[] {
  const best = new Map<string, LeaderboardEntry>();
  for (const row of rows) {
    const entry = toEntry(row);
    const current = best.get(entry.nickname);
    if (!current || compareLeaderboardEntries(entry, current) < 0) {
      best.set(entry.nickname, entry);
    }
  }
  return [...best.values()].sort(compareLeaderboardEntries).slice(0, limit);
}

/** GET /leaderboards — top players for one competitive module. */
export async function getLeaderboard(module: LeaderboardModule): Promise<LeaderboardEntry[]> {
  const rows = await prisma.gameSession.findMany({
    where: {
      module,
      status: 'SOLVED',
      solvedAt: { not: null },
      // Anonymous solves have no nickname and are not ranked.
      user: { nickname: { not: null } },
    },
    select: {
      hintsUsed: true,
      startedAt: true,
      solvedAt: true,
      user: { select: { nickname: true } },
    },
  });

  return buildLeaderboard(
    rows.map((row) => ({
      nickname: row.user.nickname!,
      hintsUsed: row.hintsUsed,
      startedAt: row.startedAt,
      solvedAt: row.solvedAt!,
    })),
  );
}
