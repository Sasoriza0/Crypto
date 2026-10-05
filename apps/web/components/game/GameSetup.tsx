'use client';

import { useState } from 'react';
import type { CipherModule, Difficulty } from '@shiftcrack/shared';
import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';
import { useI18nStore } from '@/store/i18n.store';

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

/**
 * Pre-game screen: difficulty picker + start. The phrase language follows
 * the UI locale (SDD §3: language = UI language).
 */
export function GameSetup({ module }: { module: CipherModule }) {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const startGame = useGameStore((s) => s.startGame);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [busy, setBusy] = useState(false);

  const onStart = async () => {
    if (!difficulty || busy) return;
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
    <div className="mt-8 max-w-xl">
      <h2 className="text-lg font-semibold">{t('game.difficulty')}</h2>
      <div className="mt-3 flex gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDifficulty(d)}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
              difficulty === d
                ? 'border-sky-500 bg-sky-600 text-white'
                : 'border-slate-300 hover:border-sky-400 dark:border-slate-700'
            }`}
          >
            {t(`game.difficulty.${d.toLowerCase()}`)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void onStart()}
        disabled={!difficulty || busy}
        className="mt-6 rounded-md bg-sky-600 px-5 py-2 font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t('game.starting') : t('game.start')}
      </button>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {t(`errors.${errorCode}`) !== `errors.${errorCode}` ? t(`errors.${errorCode}`) : error}
        </p>
      )}
    </div>
  );
}
