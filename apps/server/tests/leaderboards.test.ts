import { describe, expect, it } from 'vitest';
import { leaderboardQuerySchema, leaderboardResponseSchema } from '@shiftcrack/shared';
import {
  LEADERBOARD_LIMIT,
  compareLeaderboardEntries,
  timeSpentMs,
} from '../src/services/leaderboard.service.js';

/**
 * Hall of Fame ranking (SDD Phase 8): fewest hints first, then fastest
 * solve, then the earliest solve timestamp as a stable tie-break. The
 * database enforces one row per user × module and serves the board as an
 * indexed top-N query; these pure helpers pin the ranking contract.
 */

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

  it('breaks identical hints+time ties by the earliest solve', () => {
    const early = { nickname: 'a', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    const late = { nickname: 'b', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-02T00:00:00.000Z' };
    expect(compareLeaderboardEntries(early, late)).toBeLessThan(0);
  });

  it('returns 0 for identical entries', () => {
    const a = { nickname: 'a', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    const b = { nickname: 'a', hintsUsed: 1, timeSpent: 1_000, solvedAt: '2026-01-01T00:00:00.000Z' };
    expect(compareLeaderboardEntries(a, b)).toBe(0);
  });
});

describe('LEADERBOARD_LIMIT', () => {
  it('keeps the board at the spec length', () => {
    expect(LEADERBOARD_LIMIT).toBe(50);
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
