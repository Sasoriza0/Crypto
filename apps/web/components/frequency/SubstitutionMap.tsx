'use client';

import { useMemo } from 'react';
import type { Language } from '@shiftcrack/shared';
import { getAlphabet, letterFrequencies } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';
import { conflictingCiphers, useFrequencyStore } from '@/store/frequency.store';

/**
 * Substitution map (SDD §2, Phase 6): for every ciphertext letter (ordered
 * by frequency) the player picks its plaintext counterpart. Picking in the
 * dropdown creates a DRAFT (amber row); the ●/○ button locks/unlocks it
 * (bright sky row); ✕ clears it. Rows whose plain letter collides with
 * another cipher get a red ring. The interactive ciphertext remains the
 * main workspace — this panel is the structured overview.
 */
export function SubstitutionMap({ ciphertext, language }: { ciphertext: string; language: Language }) {
  const t = useT();
  const mapping = useFrequencyStore((s) => s.mapping);
  const setDraft = useFrequencyStore((s) => s.setDraft);
  const lockLetter = useFrequencyStore((s) => s.lockLetter);
  const unlockLetter = useFrequencyStore((s) => s.unlockLetter);
  const clearLetter = useFrequencyStore((s) => s.clearLetter);
  const alphabet = getAlphabet(language);
  const rows = letterFrequencies(ciphertext, alphabet);
  const conflicts = useMemo(() => conflictingCiphers(mapping), [mapping]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <h2 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800">
        {t('frequency.mapping.title')}
      </h2>
      <div className="max-h-96 overflow-y-auto p-3">
        <div className="grid gap-1 sm:grid-cols-2">
          {rows.map(({ letter }) => {
            const entry = mapping[letter];
            const locked = entry?.locked ?? false;
            return (
              <div
                key={letter}
                className={`flex items-center gap-1 rounded px-1 py-0.5 ${
                  entry
                    ? locked
                      ? 'bg-sky-200/60 dark:bg-sky-800/50'
                      : 'bg-amber-200/40 dark:bg-amber-800/30'
                    : ''
                } ${conflicts.has(letter) ? 'ring-1 ring-red-400 dark:ring-red-500' : ''}`}
              >
                <span className="w-5 shrink-0 text-center font-mono text-base">{letter}</span>
                <select
                  value={entry?.plain ?? ''}
                  onChange={(e) => setDraft(letter, e.target.value)}
                  className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">—</option>
                  {alphabet.split('').map((plain) => (
                    <option key={plain} value={plain}>
                      {plain}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => (locked ? unlockLetter(letter) : lockLetter(letter))}
                  disabled={!entry}
                  title={locked ? t('frequency.mapping.unlock') : t('frequency.mapping.lock')}
                  className="px-1 text-sm disabled:opacity-30"
                >
                  {locked ? '●' : '○'}
                </button>
                <button
                  type="button"
                  onClick={() => clearLetter(letter)}
                  disabled={!entry}
                  title={t('frequency.mapping.clear')}
                  className="px-1 text-sm text-slate-400 hover:text-red-500 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
