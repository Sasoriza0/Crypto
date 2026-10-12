'use client';

import type { SessionStatus } from '@shiftcrack/shared';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

/** Terminal non-solved states (FAILED / EXPIRED): explain + offer a new game. */
export function FailedCard({ status }: { status: SessionStatus }) {
  const t = useT();
  const reset = useGameStore((s) => s.reset);

  const expired = status === 'EXPIRED';

  return (
    <div className="mt-2 max-w-xl border-2 border-ink bg-card p-6 shadow-[5px_5px_0_rgba(66,54,36,0.16)] sm:p-8">
      <div className="flex items-start justify-between border-b border-tan pb-4">
        <div>
          <MetaLabel>{t('setup.brief')}</MetaLabel>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {expired ? t('game.expired.title') : t('game.failed.title')}
          </h2>
        </div>
        <span className="rotate-[-4deg] border-2 border-red-700 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-red-700">
          {expired ? t('game.expired.stamp') : t('game.failed.stamp')}
        </span>
      </div>

      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700"
      >
        {t('game.reset')} <span aria-hidden>→</span>
      </button>
    </div>
  );
}
