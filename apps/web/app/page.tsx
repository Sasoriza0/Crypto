'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ManualDialog } from '@/components/manual/ManualDialog';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import { MISSIONS, type MissionDef } from '@/lib/missions';
import { useAuthStore } from '@/store/auth.store';
import { useGameStore } from '@/store/game.store';
import { useI18nStore } from '@/store/i18n.store';

/**
 * Mission selection screen (Retro Spy Dossier): three mission folders,
 * each stamped with its fixed threat level — the modules themselves are
 * the difficulty scale (Mission 01 EASY → 03 HARD).
 *
 * "Initiate decryption" skips the intermediate brief: it ensures an
 * anonymous session exists, creates the game session immediately, and
 * drops the player straight onto the cipher board.
 */
export default function HomePage() {
  const t = useT();
  const router = useRouter();
  const locale = useI18nStore((s) => s.locale);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const startMission = async (mission: MissionDef) => {
    if (busySlug) return;
    setBusySlug(mission.slug);
    setError(null);
    try {
      const auth = useAuthStore.getState();
      if (auth.status !== 'authenticated') await auth.playAnonymously();
      await useGameStore.getState().startGame(mission.module, mission.difficulty, locale);
      router.push(`/modules/${mission.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 text-center md:mb-8">
        <MetaLabel>{t('menu.file')}</MetaLabel>
        <h2 className="mt-3 font-serif text-3xl font-bold leading-none sm:text-5xl md:text-6xl">
          {t('menu.select')} <span className="text-red-700">{t('menu.selectAccent')}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-mono text-xs leading-6 text-fade-dark sm:text-sm">
          {t('menu.intro')}
        </p>
        {error && <p className="mt-4 font-mono text-xs text-red-700">{error}</p>}

        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="mx-auto mt-5 inline-flex cursor-pointer items-center justify-center gap-2 border border-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink transition hover:border-red-700 hover:bg-inset hover:text-red-700"
        >
          § {t('manual.open')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {MISSIONS.map((mission) => {          const busy = busySlug === mission.slug;
          return (
            <article
              key={mission.slug}
              className="group flex min-h-[290px] flex-col border-2 border-ink bg-card p-5 shadow-[5px_5px_0_rgba(66,54,36,0.16)] transition hover:-translate-y-1 hover:shadow-[7px_8px_0_rgba(185,28,28,0.2)] sm:p-6"
            >
              <div className="flex items-start justify-between border-b border-tan pb-4">
                <span className="font-mono text-xs font-bold text-red-700">
                  {t('menu.mission')} {mission.number}
                </span>
                <span className="rotate-[-2deg] border border-red-700 px-2 py-1 font-mono text-[9px] font-bold tracking-wider text-red-700">
                  {t(`menu.threat.${mission.difficulty.toLowerCase()}`)}
                </span>
              </div>

              <div className="flex-1 pt-6">
                <MetaLabel>{t(`menu.subtitle.${mission.slug}`)}</MetaLabel>
                <h3 className="mt-2 font-serif text-xl font-bold leading-tight md:text-2xl">
                  {t(`modules.${mission.slug}.name`)}
                </h3>
                <p className="mt-3 font-mono text-xs leading-5 text-fade-dark">
                  {t(`menu.detail.${mission.slug}`)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void startMission(mission)}
                disabled={busySlug !== null}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t('game.starting') : t('menu.initiate')} <span aria-hidden>→</span>
              </button>
            </article>
          );
        })}
      </div>

      <ManualDialog open={manualOpen} onClose={() => setManualOpen(false)} />
    </section>
  );
}
