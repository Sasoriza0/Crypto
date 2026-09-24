import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/services/scoring.service.js';

describe('computeScore', () => {
  it('pays the full base for a perfect solve', () => {
    expect(computeScore({ difficulty: 'EASY', elapsedSeconds: 0, attempts: 1, hintsUsed: 0 })).toBe(100);
    expect(computeScore({ difficulty: 'MEDIUM', elapsedSeconds: 0, attempts: 1, hintsUsed: 0 })).toBe(200);
    expect(computeScore({ difficulty: 'HARD', elapsedSeconds: 0, attempts: 1, hintsUsed: 0 })).toBe(300);
  });

  it('never goes below zero', () => {
    const score = computeScore({ difficulty: 'EASY', elapsedSeconds: 99999, attempts: 50, hintsUsed: 3 });
    expect(score).toBe(0);
  });

  it('is monotonic: more attempts or hints never increase the score', () => {
    const base = computeScore({ difficulty: 'HARD', elapsedSeconds: 10, attempts: 1, hintsUsed: 0 });
    const moreAttempts = computeScore({ difficulty: 'HARD', elapsedSeconds: 10, attempts: 4, hintsUsed: 0 });
    const withHints = computeScore({ difficulty: 'HARD', elapsedSeconds: 10, attempts: 1, hintsUsed: 2 });
    expect(moreAttempts).toBeLessThan(base);
    expect(withHints).toBeLessThan(base);
  });

  it('caps the time penalty at 10 minutes', () => {
    const atCap = computeScore({ difficulty: 'HARD', elapsedSeconds: 600, attempts: 1, hintsUsed: 0 });
    const beyondCap = computeScore({ difficulty: 'HARD', elapsedSeconds: 6000, attempts: 1, hintsUsed: 0 });
    expect(beyondCap).toBe(atCap);
  });

  it('returns integers', () => {
    const score = computeScore({ difficulty: 'MEDIUM', elapsedSeconds: 12.7, attempts: 2, hintsUsed: 1 });
    expect(Number.isInteger(score)).toBe(true);
  });
});
