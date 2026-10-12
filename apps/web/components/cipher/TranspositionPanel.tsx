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
    <div className="mt-3 space-y-4">
      <div>
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('game.ciphertext')}
        </h2>
        <p className="mt-2 whitespace-pre-wrap break-words border border-ink bg-inset p-4 font-mono text-lg">
          {ciphertext}
        </p>
      </div>

      <RouteGrid ciphertext={ciphertext} textLength={textLength} onCandidateChange={setCandidate} />

      <div>
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('game.candidate')}
        </h2>
        <p className="mt-2 min-h-14 whitespace-pre-wrap break-words border border-dashed border-red-700 bg-card p-4 font-mono text-lg">
          {candidate || <span className="text-fade">{t('transposition.emptyTrace')}</span>}
        </p>
        <button
          type="button"
          onClick={() => onUseCandidate(candidate)}
          disabled={!candidate}
          className="mt-2 border border-ink px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('game.useCandidate')}
        </button>
      </div>
    </div>
  );
}
