'use client';

import { MetaLabel } from '@/components/ui/MetaLabel';
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
    <div className="mt-2 max-w-xl border-2 border-ink bg-card p-6 shadow-[5px_5px_0_rgba(66,54,36,0.16)] sm:p-8">
      <div className="flex items-start justify-between border-b border-tan pb-4">
        <div>
          <MetaLabel>{t('setup.brief')}</MetaLabel>
          <h2 className="mt-2 font-serif text-3xl font-bold">{t('game.solved.title')}</h2>
        </div>
        <span className="rotate-[-4deg] border-2 border-red-700 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-red-700">
          {t('game.solved.stamp')}
        </span>
      </div>

      {/* On a resumed session the plaintext is not re-sent (plaintext
          isolation, SDD §5) — show it only when we just solved. */}
      {plaintext && (
        <p className="mt-5 whitespace-pre-wrap break-words border border-dashed border-red-700 bg-inset p-4 font-mono text-lg">
          {plaintext}
        </p>
      )}

      <p className="mt-4 font-mono text-xs uppercase tracking-widest text-fade">
        {t('game.solved.score')}: <strong className="text-red-700">{score}</strong>
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700"
      >
        {t('game.solved.playAgain')} <span aria-hidden>→</span>
      </button>
    </div>
  );
}
