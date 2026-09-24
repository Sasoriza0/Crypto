import { z } from 'zod';

/**
 * Shared domain contracts for ShiftCrack.
 *
 * This package is the single source of truth for everything that crosses the
 * wire between the Next.js client and the Express server. Enums are exported
 * as const objects with matching literal-union types: their serialized values
 * stay stable in PostgreSQL records and JSON payloads, and the literal unions
 * are interchangeable with the Prisma-generated column types on the server.
 * The zod schemas are enforced server-side at the API edge while the client
 * reuses them to fail fast on bad input.
 */

// ---------------------------------------------------------------------------
// Domain enums
// ---------------------------------------------------------------------------

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const CipherModule = {
  CAESAR: 'CAESAR',
  TRANSPOSITION: 'TRANSPOSITION',
  FREQUENCY: 'FREQUENCY',
} as const;
export type CipherModule = (typeof CipherModule)[keyof typeof CipherModule];

export const SessionStatus = {
  ACTIVE: 'ACTIVE',
  SOLVED: 'SOLVED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// ---------------------------------------------------------------------------
// Core validation schemas
// ---------------------------------------------------------------------------

export const difficultySchema = z.nativeEnum(Difficulty);
export const cipherModuleSchema = z.nativeEnum(CipherModule);

/**
 * Only locales with curated phrase lists and matching frequency tables are
 * allowed; this guards against arbitrary locale injection at the API edge.
 */
export const languageSchema = z.enum(['uk', 'en']);
export type Language = z.infer<typeof languageSchema>;

/** POST /game/sessions */
export const createGameSessionSchema = z.object({
  module: cipherModuleSchema,
  difficulty: difficultySchema,
  language: languageSchema,
});
export type CreateGameSessionInput = z.infer<typeof createGameSessionSchema>;

/**
 * POST /game/sessions/:id/attempts
 *
 * The answer is trimmed here but deliberately NOT normalized (case folding,
 * letter filtering): normalization must remain a server-side detail applied
 * right before hashing, otherwise the client could probe the comparison
 * algorithm.
 */
export const submitAttemptSchema = z.object({
  answer: z.string().trim().min(1).max(500),
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

/** Shared URL path parameter validation (session ids are cuid strings). */
export const sessionIdSchema = z.string().cuid();
