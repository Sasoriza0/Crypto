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
    <div className="mt-3 border-l-2 border-red-700 bg-card p-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-red-700">
        {t('context.title')}:
      </span>{' '}
      <span className="font-mono text-sm text-ink">{contextClue}</span>
    </div>
  );
}
