'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Difficulty, Language } from '@shiftcrack/shared';
import { getFrequencyTable } from '@shiftcrack/shared';
import { caesarDecode, getAlphabet, letterFrequencies } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';
import { AnswerPanel } from '@/components/game/AnswerPanel';
import { AlbertiDisks } from './AlbertiDisks';
import { LetterHistogram } from './LetterHistogram';

interface CaesarPanelProps {
  ciphertext: string;
  language: Language;
  difficulty: Difficulty;
  answer: string;
  onAnswerChange: (value: string) => void;
  onUseCandidate: (candidate: string) => void;
}

/**
 * Caesar panel (Phase 6): the Alberti disks are the workspace — the player
 * rotates the inner ring and the decrypted text updates instantly. The
 * layout is two-column: the disks (with their shift controls) on the left,
 * the decryption report + answer form + abort control opposite them on the
 * right, so the whole board fits on one screen. Above the disks, two
 * frequency histograms (reference language vs. ciphertext) make
 * peak-matching visual; on HARD they are hidden.
 */
export function CaesarPanel({
  ciphertext,
  language,
  difficulty,
  answer,
  onAnswerChange,
  onUseCandidate,
}: CaesarPanelProps) {
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
    <div className="mt-3">
      <div>
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('game.ciphertext')}
        </h2>
        <p className="mt-1 whitespace-pre-wrap break-words border border-ink bg-inset p-3 font-mono text-lg">
          {ciphertext}
        </p>
      </div>

      {showHistograms && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
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

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 border border-tan bg-card p-3">
          <AlbertiDisks alphabet={alphabet} shift={shift} onShiftChange={setShift} />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
              {t('game.candidate')}
            </h2>
            <p className="mt-1 min-h-10 whitespace-pre-wrap break-words border border-dashed border-red-700 bg-card p-2 font-mono text-lg">
              {candidate}
            </p>
            <button
              type="button"
              onClick={() => onUseCandidate(candidate)}
              className="mt-1 border border-ink px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
            >
              {t('game.useCandidate')}
            </button>
          </div>

          <AnswerPanel answer={answer} onAnswerChange={onAnswerChange} />
        </div>
      </div>
    </div>
  );
}
