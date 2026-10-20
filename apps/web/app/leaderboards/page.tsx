'use client';

import { useEffect, useState } from 'react';
import type { LeaderboardEntry, LeaderboardModule, LeaderboardResponse } from '@shiftcrack/shared';
import { leaderboardResponseSchema } from '@shiftcrack/shared';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { api, ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth.store';
import { useI18nStore } from '@/store/i18n.store';

/**
 * Hall of Fame (SDD Phase 8): the ranked decrypts of the two competitive
 * missions — Frequency Analysis and Vigenère. Rendered as a retro terminal
 * roster: dark phosphor screen, mono columns (# / nickname / time / hints /
 * date). Ranking comes from the server: fewest hints first, then the
 * fastest solve.
 */

const TABS: { module: LeaderboardModule; key: string }[] = [
  { module: 'FREQUENCY', key: 'leaderboards.tab.frequency' },
  { module: 'VIGENERE', key: 'leaderboards.tab.vigenere' },
];

/** Solve time in the mission-log format: `45s`, `1m 24s`, `2h 03m`. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function formatSolvedAt(iso: string, locale: 'uk' | 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function LeaderboardsPage() {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);

  const [active, setActive] = useState<LeaderboardModule>('FREQUENCY');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The board is session-gated like the game routes: make sure a session
    // exists before the first request — but never replace a logged-in
    // operator's cookie with a fresh anonymous one.
    const auth = useAuthStore.getState();
    if (auth.status !== 'authenticated') void auth.playAnonymously().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const { entries } = await api.get<LeaderboardResponse>(
          `/leaderboards?module=${active}`,
          leaderboardResponseSchema,
        );
        if (!cancelled) setEntries(entries);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'TOO_MANY_REQUESTS') {
          setError(t('errors.TOO_MANY_REQUESTS'));
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, t]);

  return (
    <section className="mx-auto max-w-3xl">
      <div className="relative border-2 border-ink bg-card p-6 shadow-[5px_5px_0_rgba(66,54,36,0.16)] sm:p-8">
        <span
          aria-hidden
          className="absolute -top-3 right-2 rotate-[2deg] border-2 border-red-700 bg-card px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-red-700"
        >
          {t('leaderboards.stamp')}
        </span>

        <MetaLabel>{t('leaderboards.brief')}</MetaLabel>
        <h1 className="mt-2 font-serif text-3xl font-bold uppercase tracking-wide text-ink">
          {t('leaderboards.title')}
        </h1>

        {/* Mission tabs: only the two competitive missions are ranked. */}
        <div className="mt-6 flex flex-wrap gap-2 border-b-2 border-ink pb-3" role="tablist">
          {TABS.map((tab) => {
            const selected = tab.module === active;
            return (
              <button
                key={tab.module}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(tab.module)}
                className={
                  selected
                    ? 'cursor-pointer border-2 border-red-700 bg-red-700 px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper'
                    : 'cursor-pointer border-2 border-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink transition hover:border-red-700 hover:text-red-700'
                }
              >
                {t(tab.key)}
              </button>
            );
          })}
        </div>

        {/* Retro terminal roster: dossier inset in the light theme, dark
            phosphor screen in the night-archive theme. */}
        <div className="mt-4 overflow-x-auto border-2 border-ink bg-inset p-4 dark:border-stone-700 dark:bg-stone-950">
          <div className="grid grid-cols-[2rem_1fr_6rem_4rem_8rem] gap-x-3 border-b border-tan pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fade dark:border-stone-700 dark:text-stone-500">
            <span>#</span>
            <span>{t('auth.nickname')}</span>
            <span>{t('game.time')}</span>
            <span>{t('game.hints')}</span>
            <span>{t('leaderboards.date')}</span>
          </div>

          {busy && (
            <p className="mt-3 font-mono text-xs uppercase tracking-widest text-green-700 dark:text-green-400">
              &gt; {t('leaderboards.loading')}
            </p>
          )}

          {!busy && error && <p className="mt-3 font-mono text-xs uppercase tracking-widest text-red-700">&gt; {error}</p>}

          {!busy && !error && entries.length === 0 && (
            <p className="mt-3 font-mono text-xs uppercase tracking-widest text-fade dark:text-stone-400">
              &gt; {t('leaderboards.empty')}
            </p>
          )}

          {!busy &&
            !error &&
            entries.map((entry, index) => (
              <div
                key={`${entry.nickname}-${entry.solvedAt}`}
                className="grid grid-cols-[2rem_1fr_6rem_4rem_8rem] items-baseline gap-x-3 border-b border-tan/60 py-2 font-mono text-sm text-ink dark:border-stone-800/60 dark:text-stone-200"
              >
                <span className={index < 3 ? 'font-bold text-red-700' : 'text-fade dark:text-stone-500'}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="truncate font-bold text-green-700 dark:text-green-400">{entry.nickname}</span>
                <span>{formatDuration(entry.timeSpent)}</span>
                <span>{entry.hintsUsed}</span>
                <span className="text-fade dark:text-stone-400">{formatSolvedAt(entry.solvedAt, locale)}</span>
              </div>
            ))}
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-fade">
          {t('leaderboards.footer')}
        </p>
      </div>
    </section>
  );
}
