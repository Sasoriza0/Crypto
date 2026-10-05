'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { RouteGrid } from './RouteGrid';

interface TranspositionPanelProps {
  ciphertext: string;
  /** Plaintext length from session meta — trims the letter padding. */
  textLength?: number;
  onUseCandidate: (candidate: string) => void;
}

/**
 * Transposition panel (Phase 6): the column slider and click-swap are gone.
 * The route grid is the workspace — the player resizes the grid by its
 * corner (letters reflow), spots patterns via letter highlighting, and
 * traces a route across the cells to read the plaintext. The traced text
 * becomes the candidate.
 */
export function TranspositionPanel({ ciphertext, textLength, onUseCandidate }: TranspositionPanelProps) {
  const t = useT();
  const [candidate, setCandidate] = useState('');

  // New session → clean candidate.
  useEffect(() => {
    setCandidate('');
  }, [ciphertext]);

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

      <RouteGrid ciphertext={ciphertext} textLength={textLength} onCandidateChange={setCandidate} />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('game.candidate')}
        </h2>
        <p className="mt-2 min-h-14 whitespace-pre-wrap break-words rounded-lg border border-slate-200 p-4 font-mono text-lg dark:border-slate-800">
          {candidate || <span className="text-slate-400 dark:text-slate-600">{t('transposition.emptyTrace')}</span>}
        </p>
        <button
          type="button"
          onClick={() => onUseCandidate(candidate)}
          disabled={!candidate}
          className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('game.useCandidate')}
        </button>
      </div>
    </div>
  );
}
