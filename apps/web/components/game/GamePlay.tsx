'use client';

import { useEffect, useState } from 'react';
import type { CipherModule } from '@shiftcrack/shared';
import { CaesarPanel } from '@/components/cipher/CaesarPanel';
import { TranspositionPanel } from '@/components/cipher/TranspositionPanel';
import { FrequencyPanel } from '@/components/frequency/FrequencyPanel';
import { ContextBanner } from '@/components/game/ContextBanner';
import { HintsPanel } from '@/components/game/HintsPanel';
import { StatusBar } from '@/components/game/StatusBar';
import { useT } from '@/lib/i18n';
import { useFrequencyStore } from '@/store/frequency.store';
import { useGameStore } from '@/store/game.store';

/**
 * Active-game screen: timer + status strip, the module panel, hints and the
 * answer form. The candidate produced by a panel can be piped into the
 * answer input via onUseCandidate.
 */
export function GamePlay({ module }: { module: CipherModule }) {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const status = useGameStore((s) => s.status);
  const lastAttempt = useGameStore((s) => s.lastAttempt);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);
  const submitAttempt = useGameStore((s) => s.submitAttempt);
  const abandon = useGameStore((s) => s.abandon);

  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [abandonBusy, setAbandonBusy] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Reset per-session UI state when a new session starts.
  useEffect(() => {
    setAnswer('');
    setNow(Date.now());
    useFrequencyStore.getState().reset();
  }, [session?.id]);

  // Timer + lockout countdown tick once per second while playing.
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      useGameStore.getState().tick();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  if (!session) return null;

  const lockedUntilMs = session.lockedUntil ? Date.parse(session.lockedUntil) : null;
  const lockSeconds =
    lockedUntilMs && lockedUntilMs > now ? Math.ceil((lockedUntilMs - now) / 1000) : 0;
  const locked = lockSeconds > 0;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!answer.trim() || busy || locked) return;
    setBusy(true);
    try {
      await submitAttempt(answer.trim());
      setAnswer('');
    } catch {
      // error captured by the store and rendered below
    } finally {
      setBusy(false);
    }
  };

  const onAbandon = async () => {
    if (abandonBusy) return;
    setAbandonBusy(true);
    try {
      await abandon();
    } catch {
      // error captured by the store
    } finally {
      setAbandonBusy(false);
    }
  };

  const wrongAttempts = lastAttempt && !lastAttempt.correct ? lastAttempt.attempts : null;

  return (
    <div className="mt-6">
      <StatusBar />

      <ContextBanner contextClue={session.meta.contextClue} />

      {module === 'CAESAR' && (
        <CaesarPanel
          ciphertext={session.ciphertext}
          language={session.language}
          difficulty={session.difficulty}
          onUseCandidate={setAnswer}
        />
      )}
      {module === 'TRANSPOSITION' && (
        <TranspositionPanel
          ciphertext={session.ciphertext}
          textLength={session.meta.textLength}
          onUseCandidate={setAnswer}
        />
      )}
      {module === 'FREQUENCY' && (
        <FrequencyPanel
          ciphertext={session.ciphertext}
          language={session.language}
          onUseCandidate={setAnswer}
        />
      )}

      {module !== 'CAESAR' && <HintsPanel />}

      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 max-w-xl">
        <label htmlFor="answer" className="text-sm font-semibold">
          {t('game.answer.label')}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t('game.answer.placeholder')}
            disabled={locked}
            className={`w-full rounded-md border bg-white px-3 py-2 font-mono text-gray-900 dark:bg-slate-900 dark:text-white ${
              !locked && wrongAttempts !== null
                ? 'border-red-500 dark:border-red-500'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          />
          <button
            type="submit"
            disabled={!answer.trim() || busy || locked}
            className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('game.answer.submit')}
          </button>
        </div>

        {locked && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{t('game.lockout', { seconds: lockSeconds })}</p>}
        {!locked && wrongAttempts !== null && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {t('game.answer.incorrect', { attempts: wrongAttempts })}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {t(`errors.${errorCode}`) !== `errors.${errorCode}` ? t(`errors.${errorCode}`) : error}
          </p>
        )}
      </form>

      <div className="mt-8 max-w-xl">
        {!confirmAbandon ? (
          <button
            type="button"
            onClick={() => setConfirmAbandon(true)}
            className="text-sm text-red-600 hover:underline dark:text-red-400"
          >
            {t('game.abandon')}
          </button>
        ) : (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm">{t('game.abandon.confirm')}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void onAbandon()}
                disabled={abandonBusy}
                className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {t('game.abandon.yes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAbandon(false)}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t('game.abandon.no')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
