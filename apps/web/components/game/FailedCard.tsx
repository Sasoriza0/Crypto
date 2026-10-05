'use client';

import type { SessionStatus } from '@shiftcrack/shared';
import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

/** Terminal non-solved states (FAILED / EXPIRED): explain + offer a new game. */
export function FailedCard({ status }: { status: SessionStatus }) {
  const t = useT();
  const reset = useGameStore((s) => s.reset);

  return (
    <div className="mt-8 max-w-xl rounded-xl border border-slate-300 bg-slate-100 p-6 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-2xl font-bold">
        {status === 'EXPIRED' ? t('game.expired.title') : t('game.failed.title')}
      </h2>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
      >
        {t('game.reset')}
      </button>
    </div>
  );
}
