'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { effectiveMapping, useFrequencyStore } from '@/store/frequency.store';
import { useGameStore } from '@/store/game.store';

/**
 * Hint request button + the last hint text (SDD §2: components/hints/).
 * For the FREQUENCY module the player's current substitution guesses
 * (drafts + locked) are sent along so the server can target wrong mappings.
 */
export function HintsPanel() {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const lastHint = useGameStore((s) => s.lastHint);
  const requestHint = useGameStore((s) => s.requestHint);
  const mapping = useFrequencyStore((s) => s.mapping);
  const [busy, setBusy] = useState(false);
  if (!session) return null;

  const contextUsed = session.meta.contextUsed;
  const cryptoHintsUsed = session.hintsUsed - (contextUsed ? 1 : 0);
  const cryptoExhausted = cryptoHintsUsed >= session.meta.maxHints;
  // The context clue costs one hint slot on MEDIUM and can be spent once.
  const contextAvailable =
    session.difficulty === 'MEDIUM' && !contextUsed && session.meta.hintsRemaining > 0;

  const onRequest = async (kind?: 'context') => {
    setBusy(true);
    try {
      await requestHint(effectiveMapping(mapping), kind);
    } catch {
      // error captured by the store and rendered by the game screen
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border border-tan bg-inset p-3 md:p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onRequest()}
          disabled={cryptoExhausted || busy}
          className="w-full border border-ink px-3 py-2 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:py-1"
        >
          {t('game.hint.request')}
        </button>
        {contextAvailable && (
          <button
            type="button"
            onClick={() => void onRequest('context')}
            disabled={busy}
            className="w-full border border-red-700 px-3 py-2 font-mono text-xs uppercase tracking-widest text-red-700 transition hover:bg-red-700 hover:text-paper disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:py-1"
          >
            {t('game.hint.context')}
          </button>
        )}
      </div>
      {lastHint && <p className="mt-3 font-serif text-sm">{lastHint}</p>}
      {cryptoExhausted && !contextAvailable && (
        <p className="mt-2 font-mono text-xs text-fade">{t('game.hint.noneLeft')}</p>
      )}
    </div>
  );
}
