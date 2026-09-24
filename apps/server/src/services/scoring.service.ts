import type { Difficulty } from '@shiftcrack/shared';

/**
 * Scoring per SDD §4: time + attempts (+ hints). Higher difficulty pays
 * a higher base; every extra failed attempt, hint and each elapsed second
 * (capped at 10 minutes) reduce the score. Minimum score is 0.
 */

const BASE_SCORE: Record<Difficulty, number> = {
  EASY: 100,
  MEDIUM: 200,
  HARD: 300,
};

const TIME_PENALTY_PER_SECOND = 1;
const TIME_PENALTY_CAP_SECONDS = 600;
const ATTEMPT_PENALTY_FRACTION = 0.1; // per failed attempt
const HINT_PENALTY_FRACTION = 0.2; // per hint used

export interface ScoreInput {
  difficulty: Difficulty;
  /** Seconds between session start and the correct answer. */
  elapsedSeconds: number;
  /** Total attempts including the successful one. */
  attempts: number;
  hintsUsed: number;
}

export function computeScore({ difficulty, elapsedSeconds, attempts, hintsUsed }: ScoreInput): number {
  const base = BASE_SCORE[difficulty];
  const timePenalty = Math.min(Math.max(0, elapsedSeconds), TIME_PENALTY_CAP_SECONDS) * TIME_PENALTY_PER_SECOND;
  const attemptPenalty = Math.max(0, attempts - 1) * Math.round(base * ATTEMPT_PENALTY_FRACTION);
  const hintPenalty = hintsUsed * Math.round(base * HINT_PENALTY_FRACTION);
  return Math.max(0, Math.round(base - timePenalty - attemptPenalty - hintPenalty));
}
