import type { CipherModule, Difficulty, Language } from '@shiftcrack/shared';
import type { GameSession } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError, notFound } from '../lib/errors.js';
import { getAlphabet, normalizeText, sha256Hex, timingSafeEqualHex } from '../lib/text.js';
import { prisma } from '../prisma/client.js';
import { buildHint, getMaxHints } from './hints.service.js';
import { decryptCiphertext, generateChallenge } from './phrase.service.js';
import { computeScore } from './scoring.service.js';

/**
 * Game session lifecycle (SDD §4): create, attempt, hint, view, abandon,
 * expiry. Verification compares sha256(normalized answer) against the
 * stored `plaintextHash` — the plaintext is decrypted from the stored
 * cipher params only after a correct answer, never persisted.
 */

const FAILURES_PER_LOCK = 3;
const LOCK_BASE_MS = 60_000;

function gameSessionTtlMs(): number {
  return Number(process.env.GAME_SESSION_TTL_MINUTES ?? 30) * 60_000;
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
  score: number | null;
  expiresAt: Date;
  meta: { maxHints: number; hintsRemaining: number };
}

function toPublicSession(session: GameSession): PublicGameSession {
  const maxHints = getMaxHints(session.difficulty);
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
    score: session.score,
    expiresAt: session.expiresAt,
    meta: { maxHints, hintsRemaining: Math.max(0, maxHints - session.hintsUsed) },
  };
}

export async function createGameSession(userId: string, input: CreateGameSessionInput): Promise<PublicGameSession> {
  const challenge = generateChallenge(input);
  const session = await prisma.gameSession.create({
    data: {
      userId,
      module: input.module,
      difficulty: input.difficulty,
      language: input.language,
      ciphertext: challenge.ciphertext,
      plaintextHash: challenge.plaintextHash,
      cipherParams: challenge.cipherParams as Prisma.InputJsonValue,
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

export type AttemptResult =
  | { correct: false; attempts: number; lockedUntil: Date | null }
  | { correct: true; plaintext: string; score: number; attempts: number; hintsUsed: number };

export async function submitAttempt(sessionId: string, userId: string, answer: string): Promise<AttemptResult> {
  const session = await loadOwnedSession(sessionId, userId);
  assertActive(session);

  const normalized = normalizeText(answer, getAlphabet(session.language as Language));
  const answerHash = sha256Hex(normalized);
  const correct = timingSafeEqualHex(answerHash, session.plaintextHash);
  const attempts = session.attempts + 1;

  if (!correct) {
    // Anti-bruteforce per SDD §5: every 3rd failed attempt triggers a
    // cooldown that doubles each lock tier (60s -> 120s -> 240s ...).
    let lockedUntil: Date | null = null;
    if (attempts % FAILURES_PER_LOCK === 0) {
      const tier = attempts / FAILURES_PER_LOCK;
      lockedUntil = new Date(Date.now() + LOCK_BASE_MS * 2 ** (tier - 1));
    }
    await prisma.gameSession.update({
      where: { id: session.id },
      data: { attempts, lockedUntil },
    });
    return { correct: false, attempts, lockedUntil };
  }

  const plaintext = decryptCiphertext(
    session.ciphertext,
    session.module,
    session.cipherParams as unknown as Record<string, unknown>,
    session.language as Language,
  );
  const elapsedSeconds = (Date.now() - session.startedAt.getTime()) / 1000;
  const score = computeScore({
    difficulty: session.difficulty,
    elapsedSeconds,
    attempts,
    hintsUsed: session.hintsUsed,
  });

  await prisma.gameSession.update({
    where: { id: session.id },
    data: { attempts, status: 'SOLVED', solvedAt: new Date(), score, lockedUntil: null },
  });

  return { correct: true, plaintext, score, attempts, hintsUsed: session.hintsUsed };
}

export interface HintResult {
  hint: string;
  tier: number;
  hintsUsed: number;
  hintsRemaining: number;
}

export async function requestHint(sessionId: string, userId: string): Promise<HintResult> {
  const session = await loadOwnedSession(sessionId, userId);
  assertActive(session);

  const maxHints = getMaxHints(session.difficulty);
  if (session.hintsUsed >= maxHints) {
    throw new ApiError(409, 'CONFLICT', 'No more hints available for this session');
  }

  const tier = session.hintsUsed + 1;
  const hint = buildHint({
    module: session.module,
    language: session.language as Language,
    ciphertext: session.ciphertext,
    cipherParams: session.cipherParams as unknown as Record<string, unknown>,
    tier,
  });

  await prisma.gameSession.update({
    where: { id: session.id },
    data: { hintsUsed: tier },
  });

  return { hint, tier, hintsUsed: tier, hintsRemaining: maxHints - tier };
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
