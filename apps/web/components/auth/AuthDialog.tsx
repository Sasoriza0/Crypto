'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth.store';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Login / register dialog (SDD §4.2): both forms share one modal and feed
 * the existing useAuthStore actions; the server answers with a fresh
 * httpOnly session cookie and the header switches to the account view.
 *
 * Styled as a retro field-dossier: sharp-cornered paper card, thick ink
 * border, hard offset shadow, red CLASSIFIED stamp, mono inputs and a
 * dark stone submit button — matching the ExitWarning / HowToPlay chrome.
 */
export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const t = useT();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      setEmail('');
      setPassword('');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') setError(t('auth.register.exists'));
        else if (err.status === 401) setError(t('auth.login.invalid'));
        else setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-[95%] rounded-none border-2 border-stone-800 bg-paper p-4 shadow-[4px_4px_0px_0px_rgba(41,37,36,1)] md:max-w-md md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          aria-hidden
          className="absolute -top-2 right-1 origin-top-right rotate-[2deg] scale-75 border-2 border-red-700 bg-paper px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-red-700 md:-right-4 md:-top-4 md:scale-100"
        >
          {t('auth.dialog.stamp')}
        </span>

        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('auth.dialog.brief')}
        </p>

        <div className="mb-4 mt-1 flex items-start justify-between border-b border-stone-400 pb-2">
          <h2 className="font-serif text-xl font-bold uppercase tracking-wider text-stone-900">
            {mode === 'login' ? t('auth.dialog.login.title') : t('auth.dialog.register.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-sm px-1 font-mono text-lg leading-none text-stone-700 transition-colors hover:bg-stone-300/60 hover:text-red-800"
            title={t('auth.close')}
          >
            [✕]
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div>
            <label
              htmlFor="auth-email"
              className="font-mono text-xs uppercase tracking-wide text-stone-700"
            >
              {t('auth.email')}
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-none border border-stone-500 bg-transparent px-3 py-3 font-mono text-stone-900 focus:border-stone-800 focus:outline-none focus:ring-0 md:py-2"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="font-mono text-xs uppercase tracking-wide text-stone-700"
            >
              {t('auth.password')}
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="mt-1 w-full rounded-none border border-stone-500 bg-transparent px-3 py-3 font-mono text-stone-900 focus:border-stone-800 focus:outline-none focus:ring-0 md:py-2"
            />
          </div>

          {error && <p className="font-mono text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-none border border-stone-900 bg-stone-800 px-4 py-3 font-mono text-sm uppercase tracking-wider text-stone-100 transition-colors hover:border-red-700 hover:bg-red-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 md:py-2"
          >
            {busy ? '…' : mode === 'login' ? t('auth.submit.login') : t('auth.submit.register')}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="mt-3 w-full cursor-pointer text-center font-mono text-xs text-stone-700 underline transition-colors hover:text-stone-900"
        >
          {mode === 'login' ? t('auth.switchToRegister') : t('auth.switchToLogin')}
        </button>
      </div>
    </div>
  );
}
