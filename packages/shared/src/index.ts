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
  VIGENERE: 'VIGENERE',
  CHIMERA: 'CHIMERA',
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
 * OWASP password policy (SDD §5): 8-128 chars, at least one lowercase,
 * one uppercase, one digit and one special character. Enforced at the API
 * edge on registration and password reset. Shared by both schemas so the
 * policy can never drift between them.
 */
export const passwordPolicySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/,
    'Password must be 8-128 characters and include uppercase, lowercase, digit and special character',
  );

/**
 * Public handle: 3-15 chars, letters/digits/`_`/`.`/`-` only. Kept strictly
 * ASCII-safe so nicknames can never smuggle markup, control chars or
 * confusable unicode into the UI or future leaderboard payloads.
 */
export const nicknameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{3,15}$/, 'Nickname must be 3-15 characters: letters, digits, ".", "-" or "_"');

/**
 * POST /auth/register — password policy is enforced at the API edge (≥ 8
 * chars, capped to avoid bcrypt DoS via absurdly long inputs). The email is
 * normalized (trim + lowercase) here so the canonical form is stored.
 */
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  nickname: nicknameSchema,
  password: passwordPolicySchema,
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
  nickname: z.string().nullable(),
  provider: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Shared response envelope: POST /auth/anonymous|register|login, GET /auth/me. */
export const authResponseSchema = z.object({
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

// ---------------------------------------------------------------------------
// Password reset contracts (SDD §5, OWASP Forgot Password cheat sheet)
// ---------------------------------------------------------------------------

/**
 * POST /auth/forgot-password — email only, normalized like everywhere else.
 * The endpoint always answers the same way whether or not the account
 * exists (anti-enumeration).
 */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Raw reset token shape: a 256-bit CSPRNG value serialized as base64url. */
export const resetTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid reset token');

/**
 * POST /auth/reset-password — the new password must satisfy the same OWASP
 * policy as registration; the token identifies the account (no email
 * needed, the token is the capability).
 */
export const resetPasswordSchema = z.object({
  token: resetTokenSchema,
  password: passwordPolicySchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Generic responses for both endpoints (never reveal account existence). */
export const passwordResetResponseSchema = z.object({
  status: z.literal('ok'),
});
export type PasswordResetResponse = z.infer<typeof passwordResetResponseSchema>;

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
// CHIMERA mission contracts (Mission 05, SDD Phase 7)
//
// Unlike the classic ciphers, a CHIMERA session progresses through three
// interactive phases; each player action is a structured attempt validated
// at the API edge and processed by the chimera service. The final victory
// submission is still the plain answer report (submitAttemptSchema) whose
// hash must equal the target JSON assembled from all three phases.
// ---------------------------------------------------------------------------

/**
 * Phase 1: one intercepted wire packet of the MitM channel. The player
 * forges `pub_key` (their proxy key) while keeping `src` and `dst` intact —
 * the route is what makes the injection believable to both parties.
 */
export const chimeraPacketSchema = z.object({
  src: z.string().min(1).max(64),
  dst: z.string().min(1).max(64),
  pub_key: z.string().min(1).max(128),
});
export type ChimeraPacket = z.infer<typeof chimeraPacketSchema>;

export const chimeraPhaseSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type ChimeraPhase = z.infer<typeof chimeraPhaseSchema>;

/**
 * POST /game/sessions/:id/chimera — structured mission actions:
 * - `inject_packets` (phase 1): the two forged wire packets (HQ → AGENT,
 *   AGENT → HQ) with the player's proxy key swapped in;
 * - `swap_blocks` (phase 2): replace AES-ECB block `from` with block `to`;
 * - `test_jwt` (phase 3): submit the locally generated JWT for
 *   verification (signature + payload).
 */
export const chimeraAttemptSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('inject_packets'),
    hqPacket: chimeraPacketSchema,
    agentPacket: chimeraPacketSchema,
  }),
  z.object({
    action: z.literal('swap_blocks'),
    from: z.number().int().min(0).max(31),
    to: z.number().int().min(0).max(31),
  }),
  z.object({
    action: z.literal('test_jwt'),
    token: z.string().min(1).max(1000),
  }),
]);
export type ChimeraAttemptInput = z.infer<typeof chimeraAttemptSchema>;

/**
 * POST /game/sessions/:id/chimera response. `phase` is the mission phase
 * the session is in AFTER the successful action; per-action payloads
 * (forgedJson, secret) exist only on their own arm. `secret` is the
 * phase-1 reward: the JWT signing key carried by the decrypted packet
 * once the proxy injection seizes the channel.
 */
export const chimeraAttemptResponseSchema = z.discriminatedUnion('correct', [
  z.object({
    correct: z.literal(false),
    attempts: z.number().int().nonnegative(),
    lockedUntil: z.iso.datetime().nullable(),
  }),
  z.object({
    correct: z.literal(true),
    action: z.enum(['inject_packets', 'swap_blocks', 'test_jwt']),
    attempts: z.number().int().nonnegative(),
    phase: chimeraPhaseSchema,
    forgedJson: z.string().optional(),
    secret: z.string().optional(),
  }),
]);
export type ChimeraAttemptResponse = z.infer<typeof chimeraAttemptResponseSchema>;

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
    /**
     * CHIMERA-only mission state (Mission 05): the phases of the
     * MitM → AES-ECB → JWT chain that the client needs to render the
     * board. Derived server-side from the sealed `cipherParams`; secrets
     * (AES key, target JSON) never leave the session row. The two
     * intercepted packets and the player's proxy key are the phase-1
     * material; the JWT signing secret is the phase-1 reward and appears
     * once the proxy injection seizes the channel.
     */
    chimera: z
      .object({
        phase: chimeraPhaseSchema,
        mitmDone: z.boolean(),
        hqPacket: chimeraPacketSchema,
        agentPacket: chimeraPacketSchema,
        proxyKey: z.string(),
        aesBlocks: z.array(z.string()),
        originalJson: z.string(),
        jwtSecret: z.string().nullable(),
      })
      .optional(),
  }),
});
export type GameSessionResponse = z.infer<typeof gameSessionResponseSchema>;

/**
 * POST /game/sessions/:id/attempts — discriminated union: the plaintext
 * exists only on the success arm (SDD §4 plaintext isolation). No score:
 * leaderboards rank on pure solve time derived server-side from the
 * session timestamps.
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

// ---------------------------------------------------------------------------
// Leaderboard contracts (SDD Phase 8: GET /leaderboards)
// ---------------------------------------------------------------------------

/**
 * The Hall of Fame is competitive for the two long statistical missions
 * only — FREQUENCY (substitution) and VIGENERE (Kasiski). The short
 * story missions are training grounds and are never ranked.
 */
export const LeaderboardModule = {
  FREQUENCY: 'FREQUENCY',
  VIGENERE: 'VIGENERE',
} as const;
export type LeaderboardModule = (typeof LeaderboardModule)[keyof typeof LeaderboardModule];

/** GET /leaderboards?module=FREQUENCY — validated at the API edge. */
export const leaderboardQuerySchema = z.object({
  module: z.nativeEnum(LeaderboardModule),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export const leaderboardEntrySchema = z.object({
  nickname: z.string(),
  /** Solve time in milliseconds (solvedAt - startedAt). */
  timeSpent: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  solvedAt: z.iso.datetime(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

/** GET /leaderboards — top entries, fewest hints first, then fastest solve. */
export const leaderboardResponseSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

export * from './frequencies.js';
