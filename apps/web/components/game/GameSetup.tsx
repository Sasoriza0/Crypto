'use client';

import { useState } from 'react';
import type { CipherModule } from '@shiftcrack/shared';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import { difficultyForModule, missionNumberForModule } from '@/lib/missions';
import { useGameStore } from '@/store/game.store';
import { useI18nStore } from '@/store/i18n.store';

/**
 * Pre-game screen: a stamped mission brief. The difficulty picker is gone —
 * each module IS a difficulty level (CAESAR→EASY, TRANSPOSITION→MEDIUM,
 * FREQUENCY→HARD, see lib/missions.ts). The phrase language still follows
 * the UI locale (SDD §3: language = UI language).
 */
export function GameSetup({ module }: { module: CipherModule }) {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const startGame = useGameStore((s) => s.startGame);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);

  const [busy, setBusy] = useState(false);

  const difficulty = difficultyForModule(module);
  const slug = module.toLowerCase();

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startGame(module, difficulty, locale);
    } catch {
      // the store already captured the error for display
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 max-w-xl">
      <div className="border-2 border-ink bg-card p-6 shadow-[5px_5px_0_rgba(66,54,36,0.16)] sm:p-8">
        <div className="flex items-start justify-between border-b border-tan pb-4">
          <div>
            <MetaLabel>{t('setup.brief')}</MetaLabel>
            <h2 className="mt-2 font-serif text-3xl font-bold">{t(`modules.${slug}.name`)}</h2>
          </div>
          <span className="rotate-[-2deg] border border-red-700 px-2 py-1 font-mono text-[9px] font-bold tracking-wider text-red-700">
            {t(`menu.threat.${difficulty.toLowerCase()}`)}
          </span>
        </div>

        <p className="mt-5 font-mono text-xs leading-5 text-fade-dark">{t(`menu.detail.${slug}`)}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-tan pt-5">
          <span className="font-mono text-xs font-bold text-red-700">
            {t('menu.mission')} {missionNumberForModule(module)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-fade">
            {t(`menu.subtitle.${slug}`)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void onStart()}
          disabled={busy}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('game.starting') : t('menu.initiate')} <span aria-hidden>→</span>
        </button>

        {error && (
          <p className="mt-4 font-mono text-sm text-red-700">
            {t(`errors.${errorCode}`) !== `errors.${errorCode}` ? t(`errors.${errorCode}`) : error}
          </p>
        )}
      </div>
    </div>
  );
}
