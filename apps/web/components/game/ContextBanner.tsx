'use client';

import { useT } from '@/lib/i18n';

/**
 * Context banner (Phase 6): on EASY the thematic context of the challenge
 * ("Військовий наказ" etc.) is shown for free at the start of the game.
 * Renders nothing when there is no clue (MEDIUM/HARD or absent).
 */
export function ContextBanner({ contextClue }: { contextClue: string | null }) {
  const t = useT();
  if (!contextClue) return null;

  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950">
      <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        {t('context.title')}:
      </span>{' '}
      <span className="text-sm">{contextClue}</span>
    </div>
  );
}
