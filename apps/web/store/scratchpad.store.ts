'use client';

import { create } from 'zustand';

/**
 * Scratchpad slice (Phase 6): the analyst's notebook. One note per game
 * session, persisted in localStorage under `sc-scratchpad-<sessionId>` so
 * it survives reloads and stays isolated between sessions. The store only
 * holds the in-memory state; the component wires loading/autosave (a
 * debounced write captures the session id it belongs to).
 */

const KEY_PREFIX = 'sc-scratchpad-';

export function loadScratchpad(sessionId: string): string {
  try {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(`${KEY_PREFIX}${sessionId}`) ?? '';
  } catch {
    return '';
  }
}

export function saveScratchpad(sessionId: string, note: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${KEY_PREFIX}${sessionId}`, note);
  } catch {
    // storage unavailable (private mode etc.) — best-effort
  }
}

interface ScratchpadState {
  /** Drawer visibility. */
  open: boolean;
  /** Current note text. */
  note: string;
  /** Session the current note belongs to (null when nothing is loaded). */
  sessionId: string | null;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setNote: (note: string) => void;
  /** Load the note for a session; no-op when it is already loaded. */
  load: (sessionId: string) => void;
  /** Drop in-memory note state (no active session). */
  clear: () => void;
}

export const useScratchpadStore = create<ScratchpadState>()((set) => ({
  open: false,
  note: '',
  sessionId: null,
  toggle: () => set((state) => ({ open: !state.open })),
  setOpen: (open) => set({ open }),
  setNote: (note) => set({ note }),
  load: (sessionId) =>
    set((state) => {
      if (state.sessionId === sessionId) return state;
      return { sessionId, note: loadScratchpad(sessionId) };
    }),
  clear: () => set({ sessionId: null, note: '', open: false }),
}));
