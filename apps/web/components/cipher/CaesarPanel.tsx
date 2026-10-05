'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Difficulty, Language } from '@shiftcrack/shared';
import { getFrequencyTable } from '@shiftcrack/shared';
import { caesarDecode, getAlphabet, letterFrequencies } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';
import { AlbertiDisks } from './AlbertiDisks';
import { LetterHistogram } from './LetterHistogram';

interface CaesarPanelProps {
  ciphertext: string;
  language: Language;
  difficulty: Difficulty;
  onUseCandidate: (candidate: string) => void;
}

/**
 * Caesar panel (Phase 6): the slider is replaced by Alberti disks — the
 * player rotates the inner ring and the decrypted text updates instantly.
 * Above the disks, two frequency histograms (reference language vs.
 * ciphertext) make peak-matching visual; on HARD they are hidden.
 */
export function CaesarPanel({ ciphertext, language, difficulty, onUseCandidate }: CaesarPanelProps) {
  const t = useT();
  const alphabet = getAlphabet(language);
  const [shift, setShift] = useState(0);

  // New session → reset the ring.
  useEffect(() => {
    setShift(0);
  }, [ciphertext]);

  const candidate = useMemo(
    () => caesarDecode(ciphertext, shift, alphabet),
    [ciphertext, shift, alphabet],
  );

  const showHistograms = difficulty !== 'HARD';

  const referenceValues = useMemo(() => {
    const table = getFrequencyTable(language);
    return Object.fromEntries(Object.entries(table).map(([letter, freq]) => [letter, freq * 100]));
  }, [language]);

  const cipherStats = useMemo(() => {
    const values: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const row of letterFrequencies(ciphertext, alphabet)) {
      values[row.letter] = row.percent;
      counts[row.letter] = row.count;
    }
    return { values, counts };
  }, [ciphertext, alphabet]);

  // One scale for both charts so peak heights stay visually comparable.
  const scaleMax = useMemo(() => {
    const maxReference = Math.max(0, ...Object.values(referenceValues));
    const maxCipher = Math.max(0, ...Object.values(cipherStats.values));
    return Math.max(maxReference, maxCipher, 1);
  }, [referenceValues, cipherStats]);

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('game.ciphertext')}
        </h2>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-4 font-mono text-lg dark:bg-slate-900">
          {ciphertext}
        </p>
      </div>

      {showHistograms && (
        <div className="grid gap-4 lg:grid-cols-2">
          <LetterHistogram
            title={t('caesar.referenceHistogram')}
            alphabet={alphabet}
            values={referenceValues}
            scaleMax={scaleMax}
            accent="emerald"
          />
          <LetterHistogram
            title={t('caesar.cipherHistogram')}
            alphabet={alphabet}
            values={cipherStats.values}
            counts={cipherStats.counts}
            scaleMax={scaleMax}
            accent="sky"
          />
        </div>
      )}

      <AlbertiDisks alphabet={alphabet} shift={shift} onShiftChange={setShift} />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('game.candidate')}
        </h2>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-slate-200 p-4 font-mono text-lg dark:border-slate-800">
          {candidate}
        </p>
        <button
          type="button"
          onClick={() => onUseCandidate(candidate)}
          className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('game.useCandidate')}
        </button>
      </div>
    </div>
  );
}
