'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

interface AnswerPanelProps {
  answer: string;
  onAnswerChange: (value: string) => void;
  className?: string;
}

/**
 * Shared answer + abort block (Phase 6 layout): the answer input with the
 * SUBMIT REPORT button (lockout/incorrect feedback included) and the
 * two-step ABORT OPERATION control. Panels pipe their candidate into
 * `answer`; the component owns the busy/confirmation UI state and reads
 * the session, attempts and errors straight from the game store.
 */
export function AnswerPanel({ answer, onAnswerChange, className = '' }: AnswerPanelProps) {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const status = useGameStore((s) => s.status);
  const lastAttempt = useGameStore((s) => s.lastAttempt);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);
  const submitAttempt = useGameStore((s) => s.submitAttempt);
  const abandon = useGameStore((s) => s.abandon);

  const [busy, setBusy] = useState(false);
  const [abandonBusy, setAbandonBusy] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // New session → clean UI state.
  useEffect(() => {
    setBusy(false);
    setAbandonBusy(false);
    setConfirmAbandon(false);
    setNow(Date.now());
  }, [session?.id]);

  // Lockout countdown ticks once per second while playing.
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  const lockedUntilMs = session?.lockedUntil ? Date.parse(session.lockedUntil) : null;
  const lockSeconds =
    lockedUntilMs && lockedUntilMs > now ? Math.ceil((lockedUntilMs - now) / 1000) : 0;
  const locked = lockSeconds > 0;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!answer.trim() || busy || locked) return;
    setBusy(true);
    try {
      await submitAttempt(answer.trim());
      onAnswerChange('');
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
    <div className={className}>
      <form onSubmit={(e) => void onSubmit(e)}>
        <label htmlFor="answer" className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('game.answer.label')}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="answer"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder={t('game.answer.placeholder')}
            disabled={locked}
            className={`w-full border bg-card px-2 py-1.5 font-mono text-ink outline-none ${
              !locked && wrongAttempts !== null ? 'border-red-700' : 'border-tan'
            }`}
          />
          <button
            type="submit"
            disabled={!answer.trim() || busy || locked}
            className="border-2 border-ink bg-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('game.answer.submit')}
          </button>
        </div>

        {locked && <p className="mt-2 font-mono text-sm text-red-700">{t('game.lockout', { seconds: lockSeconds })}</p>}
        {!locked && wrongAttempts !== null && (
          <p className="mt-2 font-mono text-sm text-red-700">
            {t('game.answer.incorrect', { attempts: wrongAttempts })}
          </p>
        )}
        {error && (
          <p className="mt-2 font-mono text-sm text-red-700">
            {t(`errors.${errorCode}`) !== `errors.${errorCode}` ? t(`errors.${errorCode}`) : error}
          </p>
        )}
      </form>

      <div className="mt-4">
        {!confirmAbandon ? (
          <button
            type="button"
            onClick={() => setConfirmAbandon(true)}
            className="border border-red-700 px-4 py-2 font-mono text-sm uppercase tracking-widest text-red-700 transition hover:bg-red-700 hover:text-paper"
          >
            {t('game.abandon')}
          </button>
        ) : (
          <div className="border border-red-700 bg-card p-3">
            <p className="font-mono text-sm">{t('game.abandon.confirm')}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void onAbandon()}
                disabled={abandonBusy}
                className="border-2 border-red-700 bg-red-700 px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-ink hover:border-ink disabled:opacity-50"
              >
                {t('game.abandon.yes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAbandon(false)}
                className="border border-ink px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
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
