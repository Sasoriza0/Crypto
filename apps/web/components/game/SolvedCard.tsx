'use client';

import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

/** Success screen: the plaintext and score are revealed only on solve. */
export function SolvedCard() {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const lastAttempt = useGameStore((s) => s.lastAttempt);
  const reset = useGameStore((s) => s.reset);

  const plaintext = lastAttempt?.correct ? lastAttempt.plaintext : '';
  const score = session?.score ?? (lastAttempt?.correct ? lastAttempt.score : 0);

  return (
    <div className="mt-8 max-w-xl rounded-xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950">
      <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
        {t('game.solved.title')}
      </h2>
      {/* On a resumed session the plaintext is not re-sent (plaintext
          isolation, SDD §5) — show it only when we just solved. */}
      {plaintext && <p className="mt-4 break-words font-mono text-lg">{plaintext}</p>}
      <p className="mt-4 text-sm text-emerald-800 dark:text-emerald-300">
        {t('game.solved.score')}: <strong>{score}</strong>
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
      >
        {t('game.solved.playAgain')}
      </button>
    </div>
  );
}
