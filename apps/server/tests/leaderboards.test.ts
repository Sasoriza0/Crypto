import { describe, expect, it } from 'vitest';
import { leaderboardQuerySchema, leaderboardResponseSchema } from '@shiftcrack/shared';
import {
  LEADERBOARD_LIMIT,
  buildLeaderboard,
  compareLeaderboardEntries,
  timeSpentMs,
  type SolvedSessionRow,
} from '../src/services/leaderboard.service.js';

/**
 * Hall of Fame ranking (SDD Phase 8): fewest hints first, then fastest
 * solve; one entry per operator (their personal best); the board is cut to
 * LEADERBOARD_LIMIT rows. Pure pipeline tests — no database.
 */

function row(nickname: string, hintsUsed: number, startedMs: number, solvedMs: number): SolvedSessionRow {
  return { nickname, hintsUsed, startedAt: new Date(startedMs), solvedAt: new Date(solvedMs) };
}

describe('timeSpentMs', () => {
  it('computes the solve time in whole milliseconds', () => {
    expect(timeSpentMs(new Date(1_000), new Date(85_000))).toBe(84_000);
  });

  it('clamps clock-skew negatives to zero', () => {
    expect(timeSpentMs(new Date(10_000), new Date(9_000))).toBe(0);
  });
});

describe('compareLeaderboardEntries', () => {
  it('ranks fewer hints strictly first', () => {
    const fewer = { nickname: 'a', hintsUsed: 0, timeSpent: 999_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    const more = { nickname: 'b', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    expect(compareLeaderboardEntries(fewer, more)).toBeLessThan(0);
    expect(compareLeaderboardEntries(more, fewer)).toBeGreaterThan(0);
  });

  it('breaks hint ties by the fastest solve', () => {
    const fast = { nickname: 'a', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    const slow = { nickname: 'b', hintsUsed: 1, timeSpent: 2_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    expect(compareLeaderboardEntries(fast, slow)).toBeLessThan(0);
  });

  it('returns 0 for identical entries', () => {
    const a = { nickname: 'a', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    const b = { nickname: 'a', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    expect(compareLeaderboardEntries(a, b)).toBe(0);
  });
});

describe('buildLeaderboard', () => {
  it('sorts by hints ascending, then by solve time ascending', () => {
    const rows = [
      row('zeta', 2, 0, 5_000),
      row('alpha', 0, 0, 20_000), // 0 hints, slower
      row('beta', 0, 0, 10_000), // 0 hints, faster
      row('gamma', 1, 0, 1_000),
    ];
    const board = buildLeaderboard(rows);
    expect(board.map((e) => e.nickname)).toEqual(['beta', 'alpha', 'gamma', 'zeta']);
  });

  it('keeps only the personal best per operator (fewest hints, then fastest)', () => {
    const rows = [
      row('operator', 1, 0, 10_000),
      row('operator', 0, 0, 30_000), // best: 0 hints despite slower time
      row('operator', 0, 0, 20_000), // best: 0 hints, faster
    ];
    const board = buildLeaderboard(rows);
    expect(board).toHaveLength(1);
    expect(board[0]!.nickname).toBe('operator');
    expect(board[0]!.hintsUsed).toBe(0);
    expect(board[0]!.timeSpent).toBe(20_000);
  });

  it('cuts the board to the limit', () => {
    const rows = Array.from({ length: LEADERBOARD_LIMIT + 10 }, (_, i) => row(`op_${i}`, i, 0, 1_000));
    expect(buildLeaderboard(rows)).toHaveLength(LEADERBOARD_LIMIT);
  });

  it('projects ISO timestamps and whole milliseconds', () => {
    const board = buildLeaderboard([row('operator', 0, 1_000, 85_000)]);
    expect(board[0]).toEqual({
      nickname: 'operator',
      timeSpent: 84_000,
      hintsUsed: 0,
      solvedAt: new Date(85_000).toISOString(),
    });
  });

  it('returns an empty board for an empty row set', () => {
    expect(buildLeaderboard([])).toEqual([]);
  });
});

describe('leaderboard contracts (shared zod)', () => {
  it('accepts only the two competitive modules', () => {
    expect(leaderboardQuerySchema.safeParse({ module: 'FREQUENCY' }).success).toBe(true);
    expect(leaderboardQuerySchema.safeParse({ module: 'VIGENERE' }).success).toBe(true);
    expect(leaderboardQuerySchema.safeParse({ module: 'CAESAR' }).success).toBe(false);
    expect(leaderboardQuerySchema.safeParse({ module: 'CHIMERA' }).success).toBe(false);
    expect(leaderboardQuerySchema.safeParse({}).success).toBe(false);
  });

  it('parses a well-formed response envelope', () => {
    const parsed = leaderboardResponseSchema.safeParse({
      entries: [
        { nickname: 'agent_01', timeSpent: 84_000, hintsUsed: 0, solvedAt: '2026-01-01T00:00:00.000Z' },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects malformed entries (negative time, missing fields)', () => {
    expect(
      leaderboardResponseSchema.safeParse({
        entries: [{ nickname: 'x', timeSpent: -1, hintsUsed: 0, solvedAt: '2026-01-01T00:00:00.000Z' }],
      }).success,
    ).toBe(false);
  });
});
