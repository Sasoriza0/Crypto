'use client';

import { create } from 'zustand';
import type {
  AbandonResponse,
  AttemptResponse,
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

interface GameState {
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

const CLEAN_SLATE = {
  module: null as CipherModule | null,
  session: null,
  status: 'idle' as GameStatus,
  lastAttempt: null,
  lastHint: null,
  error: null,
  errorCode: null,
  elapsedSeconds: 0,
};

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
      set({ module, session, status: 'playing', elapsedSeconds: 0 });
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
        set({ module, session, status: 'playing', elapsedSeconds: 0 });
        return true;
      }
      clearSavedGame(module);
      set({ module, session, status: session.status === 'SOLVED' ? 'solved' : 'failed' });
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
              session: { ...session, status: 'SOLVED', score: result.score },
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

  resetLocal: () => set(CLEAN_SLATE),

  reset: () => {
    clearSavedGame(get().module);
    set(CLEAN_SLATE);
  },
}));
