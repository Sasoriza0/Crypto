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
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold">
            {mode === 'login' ? t('auth.dialog.login.title') : t('auth.dialog.register.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            title={t('auth.close')}
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
          <div>
            <label htmlFor="auth-email" className="text-sm font-medium">
              {t('auth.email')}
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="text-sm font-medium">
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
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {mode === 'login' ? t('auth.submit.login') : t('auth.submit.register')}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="mt-3 w-full text-center text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          {mode === 'login' ? t('auth.switchToRegister') : t('auth.switchToLogin')}
        </button>
      </div>
    </div>
  );
}
