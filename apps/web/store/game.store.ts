'use client';

import { create } from 'zustand';
import type {
  AbandonResponse,
  AttemptResponse,
  ChimeraAttemptResponse,
  ChimeraPacket,
  ChimeraPhase,
  CipherModule,
  Difficulty,
  GameSessionResponse,
  HintKind,
  HintResponse,
  Language,
  SessionStatus,
} from '@shiftcrack/shared';
import {
  abandonResponseSchema,
  attemptResponseSchema,
  chimeraAttemptResponseSchema,
  chimeraPacketSchema,
  gameSessionResponseSchema,
  hintResponseSchema,
} from '@shiftcrack/shared';
import { api, ApiError } from '@/lib/api';

/**
 * Game store (SDD §6): NOT persisted — a game session is a server-side
 * entity. Sessions are isolated PER MODULE: the active session id is saved
 * under a module-specific localStorage key (sc-game-CAESAR etc.), so
 * switching modules never leaks attempts/hints/ciphertext from another
 * module. The id is dropped once the session terminates (solved/failed/
 * expired/abandoned/reset).
 *
 * CHIMERA (Mission 05) additionally carries live mission state: the phase
 * (1 MitM, 2 ECB, 3 JWT), the two intercepted wire packets, the player's
 * proxy key, the injection-success flag and the rewards of later phases.
 * It is derived from `session.meta.chimera` on start/resume and advanced
 * by the structured attempt actions.
 */
export type GameStatus = 'idle' | 'playing' | 'solved' | 'failed';

const SAVED_KEY_PREFIX = 'sc-game';

export interface SavedGame {
  module: CipherModule;
  sessionId: string;
}

function savedKey(module: CipherModule): string {
  return `${SAVED_KEY_PREFIX}-${module}`;
}

function saveGame(module: CipherModule, sessionId: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(savedKey(module), JSON.stringify({ module, sessionId }));
    }
  } catch {
    // storage unavailable (private mode etc.) — resume is best-effort
  }
}

function clearSavedGame(module: CipherModule | null): void {
  if (!module) return;
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(savedKey(module));
  } catch {
    // ignore
  }
}

export function getSavedGame(module: CipherModule): SavedGame | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(savedKey(module));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGame>;
    if (parsed.module === module && typeof parsed.sessionId === 'string') {
      return { module: parsed.module, sessionId: parsed.sessionId };
    }
    return null;
  } catch {
    return null;
  }
}

/** The public CHIMERA projection of a session (subset of the sealed params). */
export type ChimeraMeta = NonNullable<GameSessionResponse['meta']['chimera']>;

/**
 * Outcome of a phase-1 packet injection attempt:
 * - `invalid_json`: a textarea does not hold a parseable packet;
 * - `bad_route`: the forged packet changed its `src`/`dst`;
 * - `bad_key`: `pub_key` was not replaced with the proxy key;
 * - `rejected`: the server refused the packets.
 */
export type MitMVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_json' | 'bad_route' | 'bad_key' | 'rejected' };

/** Parse and structurally validate one textarea payload as a wire packet. */
function parsePacketText(text: string): ChimeraPacket | null {
  try {
    const parsed = chimeraPacketSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

interface ChimeraState {
  chimeraPhase: ChimeraPhase;
  /** Phase 1: the two intercepted wire packets (HQ → Agent, Agent → HQ). */
  interceptedPackets: { hqPacket: ChimeraPacket; agentPacket: ChimeraPacket } | null;
  /** Phase 1: the player's proxy key to inject into both packets. */
  proxyKey: string | null;
  /** Phase 1 completed: the injection seized the key-exchange channel. */
  isMitMSuccessful: boolean;
  chimeraForgedJson: string | null;
  /** Phase 1 reward: the JWT signing secret from the decrypted packet. */
  chimeraSecret: string | null;
  setChimeraPhase: (phase: ChimeraPhase) => void;
  /**
   * Phase 1: verify the two forged packets (local JSON/route/key check +
   * server-side verification); returns the failure reason on rejection.
   */
  verifyMitMPackets: (hqPayload: string, agentPayload: string) => Promise<MitMVerifyResult>;
  /** Phase 2: propose a block substitution; returns success. */
  attemptSwap: (from: number, to: number) => Promise<boolean>;
  /** Phase 3: submit the locally generated JWT; returns success. */
  testJwt: (token: string) => Promise<boolean>;
  resetChimera: () => void;
}

interface GameState extends ChimeraState {
  /** Module the live session belongs to; null when no session is loaded. */
  module: CipherModule | null;
  session: GameSessionResponse | null;
  status: GameStatus;
  lastAttempt: AttemptResponse | null;
  lastHint: string | null;
  error: string | null;
  errorCode: string | null;
  /** Seconds elapsed since session start, advanced by the UI timer. */
  elapsedSeconds: number;
  startGame: (module: CipherModule, difficulty: Difficulty, language: Language) => Promise<void>;
  /** Resume an in-flight game after a reload; returns false on failure. */
  resume: (module: CipherModule, sessionId: string) => Promise<boolean>;
  submitAttempt: (answer: string) => Promise<void>;
  requestHint: (substitution?: Record<string, string>, kind?: HintKind) => Promise<void>;
  abandon: () => Promise<void>;
  tick: () => void;
  /** Wipe the in-memory session without touching localStorage (module switch). */
  resetLocal: () => void;
  /** Wipe everything, including the saved game id of the current module. */
  reset: () => void;
}

function errorOf(err: unknown): { error: string; errorCode: string } {
  return {
    error: err instanceof Error ? err.message : String(err),
    errorCode: err instanceof ApiError ? err.code : 'HTTP_ERROR',
  };
}

const CHIMERA_SLATE = {
  chimeraPhase: 1 as ChimeraPhase,
  interceptedPackets: null as { hqPacket: ChimeraPacket; agentPacket: ChimeraPacket } | null,
  proxyKey: null as string | null,
  isMitMSuccessful: false,
  chimeraForgedJson: null as string | null,
  chimeraSecret: null as string | null,
};

const CLEAN_SLATE = {
  module: null as CipherModule | null,
  session: null,
  status: 'idle' as GameStatus,
  lastAttempt: null,
  lastHint: null,
  error: null,
  errorCode: null,
  elapsedSeconds: 0,
  ...CHIMERA_SLATE,
};

/** Restore the CHIMERA board from the session meta (start + resume). */
function chimeraStateFromMeta(meta: ChimeraMeta | undefined) {
  if (!meta) return CHIMERA_SLATE;
  return {
    chimeraPhase: meta.phase,
    interceptedPackets: { hqPacket: meta.hqPacket, agentPacket: meta.agentPacket },
    proxyKey: meta.proxyKey,
    isMitMSuccessful: meta.mitmDone,
    chimeraForgedJson: null,
    // The secret is re-exposed in meta once phase 1 completes, so a
    // reload after the injection keeps the decrypted packet on screen.
    chimeraSecret: meta.jwtSecret,
  };
}

export const useGameStore = create<GameState>()((set, get) => ({
  ...CLEAN_SLATE,

  startGame: async (module, difficulty, language) => {
    set({ error: null, errorCode: null, lastAttempt: null, lastHint: null });
    try {
      const session = await api.post<GameSessionResponse>(
        '/game/sessions',
        { module, difficulty, language },
        gameSessionResponseSchema,
      );
      saveGame(module, session.id);
      set({
        module,
        session,
        status: 'playing',
        elapsedSeconds: 0,
        ...chimeraStateFromMeta(session.meta.chimera),
      });
    } catch (err) {
      set(errorOf(err));
      throw err;
    }
  },

  resume: async (module, sessionId) => {
    set({ error: null, errorCode: null });
    try {
      const session = await api.get<GameSessionResponse>(
        `/game/sessions/${sessionId}`,
        gameSessionResponseSchema,
      );
      if (session.module !== module) {
        clearSavedGame(module);
        return false;
      }
      if (session.status === 'ACTIVE') {
        set({
          module,
          session,
          status: 'playing',
          elapsedSeconds: 0,
          ...chimeraStateFromMeta(session.meta.chimera),
        });
        return true;
      }
      clearSavedGame(module);
      set({ module, session, status: session.status === 'SOLVED' ? 'solved' : 'failed', ...CHIMERA_SLATE });
      return true;
    } catch (err) {
      clearSavedGame(module);
      set(errorOf(err));
      return false;
    }
  },

  submitAttempt: async (answer) => {
    const { session } = get();
    if (!session) return;
    set({ error: null, errorCode: null });
    try {
      const result = await api.post<AttemptResponse>(
        `/game/sessions/${session.id}/attempts`,
        { answer },
        attemptResponseSchema,
      );
      if (result.correct) clearSavedGame(get().module);
      set(
        result.correct
          ? {
              session: { ...session, status: 'SOLVED', solvedAt: new Date().toISOString() },
              status: 'solved',
              lastAttempt: result,
            }
          : {
              session: { ...session, attempts: result.attempts, lockedUntil: result.lockedUntil },
              lastAttempt: result,
            },
      );
    } catch (err) {
      set(errorOf(err));
      throw err;
    }
  },

  requestHint: async (substitution, kind) => {
    const { session } = get();
    if (!session) return;
    set({ error: null, errorCode: null });
    try {
      const hint = await api.post<HintResponse>(
        `/game/sessions/${session.id}/hints`,
        { kind, substitution },
        hintResponseSchema,
      );
      set({
        session: {
          ...session,
          hintsUsed: hint.hintsUsed,
          meta: {
            ...session.meta,
            hintsRemaining: hint.hintsRemaining,
            contextUsed: session.meta.contextUsed || kind === 'context',
          },
        },
        lastHint: hint.hint,
      });
    } catch (err) {
      set(errorOf(err));
      throw err;
    }
  },

  abandon: async () => {
    const { session } = get();
    if (!session) return;
    set({ error: null, errorCode: null });
    try {
      const result = await api.post<AbandonResponse>(
        `/game/sessions/${session.id}/abandon`,
        undefined,
        abandonResponseSchema,
      );
      clearSavedGame(get().module);
      set({
        session: { ...session, status: result.status as SessionStatus },
        status: 'failed',
      });
    } catch (err) {
      set(errorOf(err));
      throw err;
    }
  },

  tick: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),

  // ---------------------------------------------------------------------
  // CHIMERA (Mission 05)
  // ---------------------------------------------------------------------

  setChimeraPhase: (chimeraPhase) => set({ chimeraPhase }),

  resetChimera: () => set(CHIMERA_SLATE),

  verifyMitMPackets: async (hqPayload, agentPayload) => {
    const { session, interceptedPackets, proxyKey } = get();
    if (!session || !session.meta.chimera || !interceptedPackets) {
      return { ok: false, reason: 'invalid_json' };
    }
    // Local structural check first — keeps obviously broken input (bad
    // JSON, torn routes, untouched keys) off the wire entirely.
    const hq = parsePacketText(hqPayload);
    const agent = parsePacketText(agentPayload);
    if (!hq || !agent) return { ok: false, reason: 'invalid_json' };
    const routeOk =
      hq.src === interceptedPackets.hqPacket.src &&
      hq.dst === interceptedPackets.hqPacket.dst &&
      agent.src === interceptedPackets.agentPacket.src &&
      agent.dst === interceptedPackets.agentPacket.dst;
    if (!routeOk) return { ok: false, reason: 'bad_route' };
    const keyOk =
      proxyKey !== null &&
      hq.pub_key === proxyKey &&
      agent.pub_key === proxyKey;
    if (!keyOk) return { ok: false, reason: 'bad_key' };

    set({ error: null, errorCode: null });
    try {
      const result = await api.post<ChimeraAttemptResponse>(
        `/game/sessions/${session.id}/chimera`,
        { action: 'inject_packets', hqPacket: hq, agentPacket: agent },
        chimeraAttemptResponseSchema,
      );
      if (!result.correct) {
        set({
          session: { ...session, attempts: result.attempts, lockedUntil: result.lockedUntil },
        });
        return { ok: false, reason: 'rejected' };
      }
      // The channel is seized: the server hands over the decrypted packet
      // with the JWT signing secret (phase-1 reward).
      const meta = session.meta.chimera;
      const chimeraSecret = result.secret ?? get().chimeraSecret;
      set({
        session: {
          ...session,
          attempts: result.attempts,
          meta: {
            ...session.meta,
            chimera: { ...meta, mitmDone: true, jwtSecret: chimeraSecret },
          },
        },
        isMitMSuccessful: true,
        chimeraSecret,
        // The phase stays 1 on purpose: once the injection succeeds the
        // board must render the success state (decrypted packet + "TO
        // PHASE 2"), and the button advances via setChimeraPhase(2).
      });
      return { ok: true };
    } catch (err) {
      set(errorOf(err));
      return { ok: false, reason: 'rejected' };
    }
  },

  attemptSwap: async (from, to) => {
    const { session } = get();
    if (!session) return false;
    set({ error: null, errorCode: null });
    try {
      const result = await api.post<ChimeraAttemptResponse>(
        `/game/sessions/${session.id}/chimera`,
        { action: 'swap_blocks', from, to },
        chimeraAttemptResponseSchema,
      );
      if (!result.correct) {
        set({
          session: { ...session, attempts: result.attempts, lockedUntil: result.lockedUntil },
        });
        return false;
      }
      set({
        session: { ...session, attempts: result.attempts },
        chimeraPhase: 3,
        chimeraForgedJson: result.forgedJson ?? get().chimeraForgedJson,
      });
      return true;
    } catch (err) {
      set(errorOf(err));
      return false;
    }
  },

  testJwt: async (token) => {
    const { session } = get();
    if (!session) return false;
    set({ error: null, errorCode: null });
    try {
      const result = await api.post<ChimeraAttemptResponse>(
        `/game/sessions/${session.id}/chimera`,
        { action: 'test_jwt', token },
        chimeraAttemptResponseSchema,
      );
      return result.correct;
    } catch (err) {
      set(errorOf(err));
      return false;
    }
  },

  resetLocal: () => set(CLEAN_SLATE),

  reset: () => {
    clearSavedGame(get().module);
    set(CLEAN_SLATE);
  },
}));
