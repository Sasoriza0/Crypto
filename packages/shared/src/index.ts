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

// ---------------------------------------------------------------------------
// Auth contracts (SDD §4: /auth/*)
// ---------------------------------------------------------------------------

/**
 * POST /auth/register — password policy is enforced at the API edge (≥ 8
 * chars, capped to avoid bcrypt DoS via absurdly long inputs). The email is
 * normalized (trim + lowercase) here so the canonical form is stored.
 */
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * POST /auth/login — the password minimum is deliberately relaxed on login:
 * policy is a registration concern, and rejecting short guesses outright
 * would leak which passwords exist.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Public user shape returned by every auth endpoint (no passwordHash ever). */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  provider: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Shared response envelope: POST /auth/anonymous|register|login, GET /auth/me. */
export const authResponseSchema = z.object({
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/**
 * GET /session/ping — lightweight keep-alive heartbeat. The client pings
 * every few minutes so the server-side session row and the httpOnly cookie
 * stay alive while the player solves the cipher entirely on the client
 * (zero other network traffic).
 */
export const sessionPingResponseSchema = z.object({
  status: z.literal('ok'),
  expiresAt: z.iso.datetime(),
});
export type SessionPingResponse = z.infer<typeof sessionPingResponseSchema>;

// ---------------------------------------------------------------------------
// Game contracts (SDD §4: /game/*) — the public projection the server
// returns; the client parses every response with these to fail fast.
// ---------------------------------------------------------------------------

/** POST /game/sessions → 201; GET /game/sessions/:id. No secrets here. */
export const gameSessionResponseSchema = z.object({
  id: z.string(),
  module: cipherModuleSchema,
  difficulty: difficultySchema,
  language: languageSchema,
  ciphertext: z.string(),
  status: z.nativeEnum(SessionStatus),
  attempts: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  lockedUntil: z.iso.datetime().nullable(),
  startedAt: z.iso.datetime(),
  solvedAt: z.iso.datetime().nullable(),
  score: z.number().int().nullable(),
  expiresAt: z.iso.datetime(),
  meta: z.object({
    maxHints: z.number().int().nonnegative(),
    hintsRemaining: z.number().int().nonnegative(),
    /** Plaintext length — lets the client trim transposition padding. */
    textLength: z.number().int().positive().optional(),
    /**
     * Thematic context of the challenge (e.g. "Військовий наказ"). Exposed
     * for free on EASY, null otherwise (MEDIUM gets it as a hint, HARD never).
     */
    contextClue: z.string().nullable(),
    /** Whether the MEDIUM context-hint slot has been spent (false elsewhere). */
    contextUsed: z.boolean(),
  }),
});
export type GameSessionResponse = z.infer<typeof gameSessionResponseSchema>;

/**
 * POST /game/sessions/:id/attempts — discriminated union: the plaintext and
 * score exist only on the success arm (SDD §4 plaintext isolation).
 */
export const attemptResponseSchema = z.discriminatedUnion('correct', [
  z.object({
    correct: z.literal(false),
    attempts: z.number().int().positive(),
    lockedUntil: z.iso.datetime().nullable(),
  }),
  z.object({
    correct: z.literal(true),
    plaintext: z.string(),
    score: z.number().int().positive(),
    attempts: z.number().int().positive(),
    hintsUsed: z.number().int().nonnegative(),
  }),
]);
export type AttemptResponse = z.infer<typeof attemptResponseSchema>;

/** POST /game/sessions/:id/hints. `tier` is null for a context hint. */
export const hintResponseSchema = z.object({
  hint: z.string(),
  tier: z.number().int().positive().nullable(),
  hintsUsed: z.number().int().positive(),
  hintsRemaining: z.number().int().nonnegative(),
});
export type HintResponse = z.infer<typeof hintResponseSchema>;

/** POST /game/sessions/:id/abandon. */
export const abandonResponseSchema = z.object({
  status: z.nativeEnum(SessionStatus),
});
export type AbandonResponse = z.infer<typeof abandonResponseSchema>;

/**
 * What kind of help the player asks for when spending a hint slot:
 * - `cipher` (default): the module-specific crypto hint tier;
 * - `context`: the thematic context clue — MEDIUM difficulty only, once.
 */
export const HintKind = {
  CIPHER: 'cipher',
  CONTEXT: 'context',
} as const;
export type HintKind = (typeof HintKind)[keyof typeof HintKind];

/**
 * POST /game/sessions/:id/hints request body. The optional `substitution`
 * carries the player's current cipher→plain guesses for the FREQUENCY
 * module so hints can target wrong mappings; keys/values are single
 * letters and are sanitized again server-side.
 */
export const hintRequestSchema = z.object({
  kind: z.nativeEnum(HintKind).optional(),
  substitution: z.record(z.string().max(1), z.string().max(1)).optional(),
});
export type HintRequestInput = z.infer<typeof hintRequestSchema>;

// ---------------------------------------------------------------------------
// Module metadata (SDD §4: GET /game/modules — i18n/static guides)
// ---------------------------------------------------------------------------

export const moduleMetadataSchema = z.object({
  id: cipherModuleSchema,
  slug: z.string(),
  difficulties: z.array(difficultySchema),
});
export type ModuleMetadata = z.infer<typeof moduleMetadataSchema>;

/** GET /game/modules. */
export const modulesResponseSchema = z.object({
  modules: z.array(moduleMetadataSchema),
});
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;

export * from './frequencies.js';
