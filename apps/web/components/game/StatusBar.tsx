'use client';

import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Attempts / hints / elapsed time strip shown above the module panel. */
export function StatusBar() {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds);
  if (!session) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
      <span>
        {t('game.attempts')}: <strong>{session.attempts}</strong>
      </span>
      <span>
        {t('game.hints')}: <strong>{session.hintsUsed}</strong>/{session.meta.maxHints}
      </span>
      <span>
        {t('game.time')}: <strong>{formatSeconds(elapsedSeconds)}</strong>
      </span>
    </div>
  );
}
