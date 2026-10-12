'use client';

import { useMemo } from 'react';
import type { Language } from '@shiftcrack/shared';
import { CustomSelect } from '@/components/ui/CustomSelect';
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
    <div className="border border-tan bg-card">
      <h2 className="border-b border-tan px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
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
                className={`flex items-center gap-1 px-1 py-0.5 ${
                  entry
                    ? locked
                      ? 'bg-sky-200/60 dark:bg-sky-800/50'
                      : 'bg-amber-200/40 dark:bg-amber-800/30'
                    : ''
                } ${conflicts.has(letter) ? 'ring-1 ring-red-700' : ''}`}
              >
                <span className="w-5 shrink-0 text-center font-mono text-base text-ink">{letter}</span>
                <CustomSelect
                  value={entry?.plain ?? ''}
                  options={alphabet.split('')}
                  onChange={(plain) => setDraft(letter, plain)}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => (locked ? unlockLetter(letter) : lockLetter(letter))}
                  disabled={!entry}
                  title={locked ? t('frequency.mapping.unlock') : t('frequency.mapping.lock')}
                  className="px-1 font-mono text-sm text-fade transition hover:text-red-700 disabled:opacity-30"
                >
                  {locked ? '●' : '○'}
                </button>
                <button
                  type="button"
                  onClick={() => clearLetter(letter)}
                  disabled={!entry}
                  title={t('frequency.mapping.clear')}
                  className="px-1 font-mono text-sm text-fade transition hover:text-red-700 disabled:opacity-30"
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
