'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { PasswordStrength, passwordChecksOf, passwordPolicyMet } from '@/components/auth/PasswordStrength';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth.store';

interface ResetPasswordFormProps {
  /** Raw token from the email link query string ('' when absent). */
  token: string;
}

/**
 * Reset password form (SDD §5): accepts the one-shot token from the email
 * link, enforces the same OWASP password policy as registration (with the
 * live checklist) and reports a generic failure for invalid/expired links.
 * On success all previous sessions are dead — the operator signs in anew.
 */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useT();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const checks = passwordChecksOf(password);
  const policyMet = passwordPolicyMet(checks);
  const mismatch = confirm.length > 0 && password !== confirm;
  const noToken = !token.trim();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (noToken) {
      setError(t('reset.invalid'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESET_TOKEN_INVALID') {
        setError(t('reset.invalid'));
      } else if (err instanceof ApiError && err.code === 'TOO_MANY_REQUESTS') {
        setError(t('errors.TOO_MANY_REQUESTS'));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto mt-10 max-w-md px-4">
      <div className="relative border-2 border-ink bg-card p-6 shadow-[5px_5px_0_rgba(66,54,36,0.16)] md:p-8">
        <span
          aria-hidden
          className="absolute -top-3 right-2 rotate-[2deg] border-2 border-red-700 bg-card px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-red-700"
        >
          {t('auth.dialog.stamp')}
        </span>

        <MetaLabel>{t('reset.brief')}</MetaLabel>
        <h1 className="mt-2 font-serif text-2xl font-bold uppercase tracking-wider text-ink">{t('reset.title')}</h1>

        {done ? (
          <div className="mt-6">
            <p className="border border-dashed border-red-700 bg-inset p-4 font-mono text-sm leading-6 text-ink">
              {t('reset.success.title')}
            </p>
            <p className="mt-4 font-mono text-xs leading-5 text-fade-dark">{t('reset.success.body')}</p>
            <Link
              href="/"
              className="mt-6 inline-flex w-full items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700"
            >
              {t('reset.toLogin')} <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <div>
              <label htmlFor="reset-password" className="font-mono text-xs uppercase tracking-wide text-fade-dark">
                {t('reset.password')}
              </label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className="mt-1 w-full rounded-none border border-ink/60 bg-transparent px-3 py-3 font-mono text-ink focus:border-ink focus:outline-none focus:ring-0"
              />
              <PasswordStrength password={password} />
            </div>

            <div>
              <label htmlFor="reset-confirm" className="font-mono text-xs uppercase tracking-wide text-fade-dark">
                {t('reset.confirm')}
              </label>
              <input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className="mt-1 w-full rounded-none border border-ink/60 bg-transparent px-3 py-3 font-mono text-ink focus:border-ink focus:outline-none focus:ring-0"
              />
              {mismatch && <p className="mt-1 font-mono text-xs text-red-700">{t('reset.mismatch')}</p>}
            </div>

            {error && <p className="font-mono text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={busy || !policyMet || mismatch || noToken}
              title={!policyMet ? t('auth.password.policyTitle') : undefined}
              className="w-full cursor-pointer border-2 border-ink bg-ink px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '…' : t('reset.submit')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
