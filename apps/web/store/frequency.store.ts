'use client';

import { create } from 'zustand';

/**
 * Frequency module slice (SDD §6, Phase 6): the cipher→plain substitution
 * map lives in a separate store so typing a mapping re-renders only the
 * frequency panel, not the whole game screen (selective subscriptions).
 *
 * Phase 6 adds the analyst workflow: every mapping is either a DRAFT
 * (hypothesis, shown semi-transparent amber) or LOCKED (committed, shown
 * bright). Drafts still substitute into the candidate text — locking is
 * about commitment, not about which letters get used.
 */

export interface SubstitutionEntry {
  plain: string;
  locked: boolean;
}

/** Flatten the entry map to the cipher→plain record used by cipher utils. */
export function effectiveMapping(mapping: Record<string, SubstitutionEntry>): Record<string, string> {
  return Object.fromEntries(Object.entries(mapping).map(([cipher, entry]) => [cipher, entry.plain]));
}

/** Cipher letters whose plain letter is also assigned to another cipher. */
export function conflictingCiphers(mapping: Record<string, SubstitutionEntry>): Set<string> {
  const byPlain = new Map<string, string[]>();
  for (const [cipher, entry] of Object.entries(mapping)) {
    const list = byPlain.get(entry.plain) ?? [];
    list.push(cipher);
    byPlain.set(entry.plain, list);
  }
  const out = new Set<string>();
  for (const list of byPlain.values()) {
    if (list.length > 1) for (const cipher of list) out.add(cipher);
  }
  return out;
}

interface FrequencyState {
  /** ciphertext letter -> substitution entry (draft or locked). */
  mapping: Record<string, SubstitutionEntry>;
  /** Set (or replace) a hypothesis; empty plain removes the entry. */
  setDraft: (cipherLetter: string, plainLetter: string) => void;
  /** Commit the current draft of a letter. */
  lockLetter: (cipherLetter: string) => void;
  /** Demote a locked letter back to a draft. */
  unlockLetter: (cipherLetter: string) => void;
  /** Remove any mapping for a letter. */
  clearLetter: (cipherLetter: string) => void;
  reset: () => void;
}

export const useFrequencyStore = create<FrequencyState>()((set) => ({
  mapping: {},
  setDraft: (cipherLetter, plainLetter) =>
    set((state) => {
      if (plainLetter === '') {
        if (!(cipherLetter in state.mapping)) return state;
        const next = { ...state.mapping };
        delete next[cipherLetter];
        return { mapping: next };
      }
      return { mapping: { ...state.mapping, [cipherLetter]: { plain: plainLetter, locked: false } } };
    }),
  lockLetter: (cipherLetter) =>
    set((state) => {
      const entry = state.mapping[cipherLetter];
      if (!entry || entry.locked) return state;
      return { mapping: { ...state.mapping, [cipherLetter]: { ...entry, locked: true } } };
    }),
  unlockLetter: (cipherLetter) =>
    set((state) => {
      const entry = state.mapping[cipherLetter];
      if (!entry || !entry.locked) return state;
      return { mapping: { ...state.mapping, [cipherLetter]: { ...entry, locked: false } } };
    }),
  clearLetter: (cipherLetter) =>
    set((state) => {
      if (!(cipherLetter in state.mapping)) return state;
      const next = { ...state.mapping };
      delete next[cipherLetter];
      return { mapping: next };
    }),
  reset: () => set({ mapping: {} }),
}));
