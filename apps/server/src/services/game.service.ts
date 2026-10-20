import type { ChimeraAttemptInput, ChimeraAttemptResponse, ChimeraPacket, CipherModule, Difficulty, HintKind, Language } from '@shiftcrack/shared';
import type { GameSession } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError, notFound } from '../lib/errors.js';
import { getAlphabet, normalizeText, sha256Hex, timingSafeEqualHex } from '../lib/text.js';
import { prisma } from '../prisma/client.js';
import { chimeraFullyDone, chimeraPhase1Done, chimeraPhaseOf, parseChimeraParams, processChimeraAttempt } from './ciphers/chimera.js';
import { buildContextHint, buildHint, getMaxHints } from './hints.service.js';
import { decryptCiphertext, generateChallenge } from './phrase.service.js';
import * as enCorpus from './phrases/en.js';
import * as ukCorpus from './phrases/uk.js';

/**
 * Game session lifecycle (SDD §4): create, attempt, hint, view, abandon,
 * expiry. Verification compares sha256(normalized answer) against the
 * stored `plaintextHash` — the plaintext is decrypted from the stored
 * cipher params only after a correct answer, never persisted.
 */

/** Consecutive failures before a cooldown (softened per Phase 5 UX). */
const FAILURES_PER_LOCK = 10;
const LOCK_BASE_MS = 60_000;

/**
 * Hard 24h floor (same reasoning as the auth session TTL in
 * session.service.ts): `GAME_SESSION_TTL_MINUTES` may only raise the
 * window, never lower it. Missing/empty/NaN/sub-24h values fall back to
 * 1440 minutes, so a stray env value can no longer expire sessions in
 * 10-30 minutes while a player is still thinking locally.
 */
const MIN_GAME_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function gameSessionTtlMs(): number {
  const raw = Number(process.env.GAME_SESSION_TTL_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) return MIN_GAME_SESSION_TTL_MS;
  return Math.max(raw, 1440) * 60_000;
}

export interface CreateGameSessionInput {
  module: CipherModule;
  difficulty: Difficulty;
  language: Language;
}

export interface PublicGameSession {
  id: string;
  module: CipherModule;
  difficulty: Difficulty;
  language: Language;
  ciphertext: string;
  status: string;
  attempts: number;
  hintsUsed: number;
  lockedUntil: Date | null;
  startedAt: Date;
  solvedAt: Date | null;
  expiresAt: Date;
  meta: {
    maxHints: number;
    hintsRemaining: number;
    textLength?: number;
    contextClue: string | null;
    contextUsed: boolean;
    chimera?: {
      phase: 1 | 2 | 3;
      mitmDone: boolean;
      hqPacket: ChimeraPacket;
      agentPacket: ChimeraPacket;
      proxyKey: string;
      aesBlocks: string[];
      originalJson: string;
      /** Phase 1 reward: the JWT signing secret (null until the injection). */
      jwtSecret: string | null;
    };
  };
}

/** Plaintext length so the client can trim transposition padding exactly. */
function textLengthOf(session: GameSession): number {
  if (session.module === 'TRANSPOSITION') {
    const params = session.cipherParams as { length?: unknown };
    if (typeof params.length === 'number') return params.length;
  }
  return session.ciphertext.length;
}

/** Crypto hint tiers plus one context slot on MEDIUM-difficulty sessions. */
function totalHintBudget(difficulty: Difficulty, module: CipherModule): number {
  return getMaxHints(module) + (difficulty === 'MEDIUM' ? 1 : 0);
}

function toPublicSession(session: GameSession): PublicGameSession {
  const maxHints = getMaxHints(session.module);
  const chimera =
    session.module === 'CHIMERA'
      ? (() => {
          const params = parseChimeraParams(session.cipherParams);
          return {
            phase: chimeraPhaseOf(params),
            mitmDone: params.mitmDone,
            hqPacket: params.hqPacket,
            agentPacket: params.agentPacket,
            proxyKey: params.proxyKey,
            aesBlocks: params.aesBlocks,
            originalJson: params.originalJson,
            // The signing secret is the phase-1 reward: projected only
            // once the injection seizes the channel, never before.
            jwtSecret: chimeraPhase1Done(params) ? params.jwtSecret : null,
          };
        })()
      : undefined;
  return {
    id: session.id,
    module: session.module,
    difficulty: session.difficulty,
    language: session.language as Language,
    ciphertext: session.ciphertext,
    status: session.status,
    attempts: session.attempts,
    hintsUsed: session.hintsUsed,
    lockedUntil: session.lockedUntil,
    startedAt: session.startedAt,
    solvedAt: session.solvedAt,
    expiresAt: session.expiresAt,
    meta: {
      maxHints,
      hintsRemaining: Math.max(0, totalHintBudget(session.difficulty, session.module) - session.hintsUsed),
      textLength: textLengthOf(session),
      // Phase 6 → missions: the context clue is shown free only in the
      // FREQUENCY module (the long statistical challenge); CAESAR never
      // needs it and TRANSPOSITION keeps it as a MEDIUM hint slot.
      contextClue: session.module === 'FREQUENCY' ? session.contextClue : null,
      contextUsed: session.contextUsed,
      chimera,
    },
  };
}

export async function createGameSession(userId: string, input: CreateGameSessionInput): Promise<PublicGameSession> {
  // Challenge generation is difficulty-agnostic (story-fixed missions):
  // the cipher params follow one balanced profile per module. The session
  // row still records the requested difficulty for mission flavor and the
  // lockout/context-hint rules.
  const challenge = generateChallenge({ module: input.module, language: input.language });
  const session = await prisma.gameSession.create({
    data: {
      userId,
      module: input.module,
      difficulty: input.difficulty,
      language: input.language,
      ciphertext: challenge.ciphertext,
      plaintextHash: challenge.plaintextHash,
      cipherParams: challenge.cipherParams as Prisma.InputJsonValue,
      contextClue: challenge.context,
      expiresAt: new Date(Date.now() + gameSessionTtlMs()),
    },
  });
  return toPublicSession(session);
}

/**
 * Load a session owned by the user; lazily expires ACTIVE rows whose TTL
 * has passed. Returns 404 for missing sessions and for sessions owned by
 * someone else (no existence oracle).
 */
async function loadOwnedSession(sessionId: string, userId: string): Promise<GameSession> {
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw notFound('Game session not found');
  }
  if (session.status === 'ACTIVE' && session.expiresAt.getTime() <= Date.now()) {
    const updated = await prisma.gameSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    });
    return updated;
  }
  return session;
}

function assertActive(session: GameSession): void {
  if (session.status === 'EXPIRED') {
    throw new ApiError(410, 'SESSION_EXPIRED', 'This game session has expired');
  }
  if (session.status !== 'ACTIVE') {
    throw new ApiError(409, 'SESSION_NOT_ACTIVE', `Session is ${session.status.toLowerCase()}`);
  }
  if (session.lockedUntil && session.lockedUntil.getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil((session.lockedUntil.getTime() - Date.now()) / 1000);
    throw new ApiError(423, 'SESSION_LOCKED', `Too many failed attempts. Retry in ${retryAfterSeconds}s.`, {
      retryAfterSeconds,
    });
  }
}

/**
 * Sliding renewal: every real interaction (attempt, hint) pushes the
 * expiry a full TTL forward, so an active player can never lose an
 * in-flight game to the clock.
 */
async function touchGameSession(session: GameSession): Promise<void> {
  if (session.status !== 'ACTIVE') return;
  await prisma.gameSession.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() + gameSessionTtlMs()) },
  });
}

export type AttemptResult =
  | { correct: false; attempts: number; lockedUntil: Date | null }
  | { correct: true; plaintext: string; attempts: number; hintsUsed: number };

/**
 * Victory reveal: `decryptCiphertext` returns exactly the PREPARED text,
 * which for TRANSPOSITION and HARD sessions is a solid letter stream
 * (spaces stripped by design). For the final screen we recover the ORIGINAL
 * corpus phrase — with spaces and punctuation — by matching the letters-only
 * stream against the static corpus. The plaintext itself is still never
 * stored: the DB holds only the hash + cipher params, and the corpus lives
 * in source code. Falls back to the prepared text if no corpus match exists
 * (e.g. legacy dev-DB sessions from older corpora).
 */
export function revealPlaintext(language: Language, prepared: string): string {
  const alphabet = getAlphabet(language);
  const stream = normalizeText(prepared, alphabet);
  const corpus = language === 'uk' ? ukCorpus.phrases : enCorpus.phrases;
  const match = corpus.find((phrase) => normalizeText(phrase.text, alphabet) === stream);
  return match?.text ?? prepared;
}

export async function submitAttempt(sessionId: string, userId: string, answer: string): Promise<AttemptResult> {
  const session = await loadOwnedSession(sessionId, userId);
  assertActive(session);
  await touchGameSession(session);

  // CHIMERA: the final report is only gradeable once all three phases are
  // complete — its hash covers the target JSON assembled from the phases.
  const chimera = session.module === 'CHIMERA' ? parseChimeraParams(session.cipherParams) : null;
  if (chimera && !chimeraFullyDone(chimera)) {
    throw new ApiError(409, 'CHIMERA_PHASE', 'Complete all three phases before submitting the final report');
  }

  // CHIMERA's answer is the exact target JSON (whitespace-trimmed only);
  // classic modules normalize letters via the language alphabet.
  const answerHash = chimera
    ? sha256Hex(answer.trim())
    : sha256Hex(normalizeText(answer, getAlphabet(session.language as Language)));
  const correct = timingSafeEqualHex(answerHash, session.plaintextHash);
  const attempts = session.attempts + 1;

  if (!correct) {
    // Anti-bruteforce per SDD §5 (softened): every 10th failed attempt
    // triggers a cooldown that doubles each lock tier (60s -> 120s -> ...).
    // EASY sessions never lock out — learning beats punishment there.
    let lockedUntil: Date | null = null;
    if (session.difficulty !== 'EASY' && attempts % FAILURES_PER_LOCK === 0) {
      const tier = attempts / FAILURES_PER_LOCK;
      lockedUntil = new Date(Date.now() + LOCK_BASE_MS * 2 ** (tier - 1));
    }
    await prisma.gameSession.update({
      where: { id: session.id },
      data: { attempts, lockedUntil },
    });
    return { correct: false, attempts, lockedUntil };
  }

  const decrypted = chimera
    ? chimera.targetJson
    : decryptCiphertext(
        session.ciphertext,
        session.module,
        session.cipherParams as unknown as Record<string, unknown>,
        session.language as Language,
      );
  const plaintext = chimera
    ? chimera.targetJson
    : revealPlaintext(session.language as Language, decrypted);

  // Leaderboards rank on pure solve time (solvedAt - startedAt), so only
  // the attempts/counters and the solve timestamp are persisted — no score.
  await prisma.gameSession.update({
    where: { id: session.id },
    data: { attempts, status: 'SOLVED', solvedAt: new Date(), lockedUntil: null },
  });

  return { correct: true, plaintext, attempts, hintsUsed: session.hintsUsed };
}

/**
 * Structured CHIMERA attempts (Mission 05): inject_packets / swap_blocks /
 * test_jwt. Delegates the verification to the pure chimera service and
 * persists the phase progress back into `cipherParams`.
 *
 * - `test_jwt` submissions never increment the attempt counter and never
 *   trigger the bruteforce lockout — the player may iterate on the locally
 *   generated token until the payload and signature are right.
 * - inject_packets / swap_blocks failures count as regular attempts.
 */
export async function submitChimeraAttempt(
  sessionId: string,
  userId: string,
  input: ChimeraAttemptInput,
): Promise<ChimeraAttemptResponse> {
  const session = await loadOwnedSession(sessionId, userId);
  assertActive(session);
  if (session.module !== 'CHIMERA') {
    throw new ApiError(409, 'CONFLICT', 'Structured attempts are only available for the CHIMERA mission');
  }
  await touchGameSession(session);

  const params = parseChimeraParams(session.cipherParams);

  // Phase gates: each action unlocks only after the previous phase.
  if (input.action === 'swap_blocks' && !chimeraPhase1Done(params)) {
    throw new ApiError(409, 'CHIMERA_PHASE', 'Complete phase 1 (packet injection) first');
  }
  if (input.action === 'test_jwt' && !params.phase2Done) {
    throw new ApiError(409, 'CHIMERA_PHASE', 'Complete phase 2 (block substitution) first');
  }

  const result = processChimeraAttempt(params, input);
  const attempts = input.action === 'test_jwt' ? session.attempts : session.attempts + 1;

  await prisma.gameSession.update({
    where: { id: session.id },
    data: {
      attempts,
      cipherParams: result.updatedParams as unknown as Prisma.InputJsonValue,
    },
  });

  if (!result.correct) {
    return {
      correct: false,
      attempts,
      lockedUntil: null,
    };
  }

  return {
    correct: true,
    action: input.action,
    attempts,
    phase: chimeraPhaseOf(result.updatedParams),
    ...(result.payload.forgedJson !== undefined ? { forgedJson: result.payload.forgedJson } : {}),
    ...(result.payload.secret !== undefined ? { secret: result.payload.secret } : {}),
  };
}

export interface HintResult {
  hint: string;
  tier: number | null;
  hintsUsed: number;
  hintsRemaining: number;
}

export async function requestHint(
  sessionId: string,
  userId: string,
  kind: HintKind | undefined,
  substitution?: Record<string, string>,
): Promise<HintResult> {
  const session = await loadOwnedSession(sessionId, userId);
  assertActive(session);
  await touchGameSession(session);

  const maxHints = getMaxHints(session.module);
  const isContext = kind === 'context';

  if (isContext) {
    // The context clue exists as a hint only on MEDIUM (EASY shows it for
    // free, HARD hides it entirely) and may be spent exactly once.
    if (session.difficulty !== 'MEDIUM' || !session.contextClue || session.contextUsed) {
      throw new ApiError(400, 'CONTEXT_UNAVAILABLE', 'The context clue is not available for this session');
    }
  }

  // Total budget: the fixed crypto tiers plus one context slot on
  // MEDIUM-difficulty sessions. The context spend does not advance the
  // crypto tier.
  const cryptoHintsUsed = session.hintsUsed - (session.contextUsed ? 1 : 0);
  const tier = cryptoHintsUsed + 1;
  const totalBudget = totalHintBudget(session.difficulty, session.module);
  if (session.hintsUsed >= totalBudget || (!isContext && tier > maxHints)) {
    throw new ApiError(409, 'CONFLICT', 'No more hints available for this session');
  }

  const hint = isContext
    ? buildContextHint(session.language as Language, session.contextClue!)
    : buildHint({
        module: session.module,
        language: session.language as Language,
        ciphertext: session.ciphertext,
        cipherParams: session.cipherParams as unknown as Record<string, unknown>,
        tier,
        substitution,
      });

  await prisma.gameSession.update({
    where: { id: session.id },
    data: {
      hintsUsed: session.hintsUsed + 1,
      contextUsed: isContext ? true : session.contextUsed,
    },
  });

  const hintsUsed = session.hintsUsed + 1;
  return {
    hint,
    tier: isContext ? null : tier,
    hintsUsed,
    hintsRemaining: Math.max(0, totalBudget - hintsUsed),
  };
}

export async function getGameSession(sessionId: string, userId: string): Promise<PublicGameSession> {
  const session = await loadOwnedSession(sessionId, userId);
  return toPublicSession(session);
}

export async function abandonGameSession(sessionId: string, userId: string): Promise<{ status: string }> {
  const session = await loadOwnedSession(sessionId, userId);
  if (session.status === 'ACTIVE') {
    await prisma.gameSession.update({
      where: { id: session.id },
      data: { status: 'FAILED' },
    });
    return { status: 'FAILED' };
  }
  return { status: session.status };
}

/** Periodic sweep over the (status, expiresAt) index (called by index.ts). */
export async function expireGameSessions(): Promise<number> {
  const result = await prisma.gameSession.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}

/**
 * Heartbeat support: pushes the expiry of every ACTIVE session of the user
 * forward by a full TTL. Called by the session ping endpoint so a player
 * working purely locally (no attempt/hint traffic for minutes) never loses
 * an in-flight game to the clock.
 */
export async function touchActiveGameSessions(userId: string): Promise<number> {
  const result = await prisma.gameSession.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { expiresAt: new Date(Date.now() + gameSessionTtlMs()) },
  });
  return result.count;
}
