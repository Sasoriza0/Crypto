'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { PasswordStrength, passwordPolicyMet, passwordChecksOf } from '@/components/auth/PasswordStrength';
import { useAuthStore } from '@/store/auth.store';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'register' | 'forgot';

/**
 * Login / register / forgot-password dialog (SDD §4.2): all three forms
 * share one modal and feed the useAuthStore actions; the server answers
 * with a fresh httpOnly session cookie and the header switches to the
 * account view. Registration shows a live OWASP password checklist and
 * the forgot mode always confirms identically (anti-enumeration).
 *
 * Styled as a retro field-dossier: sharp-cornered paper card, thick ink
 * border, hard offset shadow, red CLASSIFIED stamp, mono inputs and a
 * dark stone submit button — matching the ExitWarning / HowToPlay chrome.
 */
export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const t = useT();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const close = () => {
    setMode('login');
    setEmail('');
    setNickname('');
    setPassword('');
    setError(null);
    setNotice(null);
    onClose();
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        setEmail('');
        setPassword('');
        close();
      } else if (mode === 'register') {
        await register(email, nickname, password);
        setEmail('');
        setNickname('');
        setPassword('');
        close();
      } else {
        await forgotPassword(email);
        setNotice(t('auth.forgot.sent'));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const conflictField =
          err.code === 'CONFLICT' && err.details && typeof err.details === 'object'
            ? (err.details as { field?: string }).field
            : undefined;
        if (conflictField === 'nickname') setError(t('auth.register.nicknameExists'));
        else if (conflictField === 'email') setError(t('auth.register.exists'));
        else if (err.code === 'CONFLICT') setError(t('auth.register.exists'));
        else if (err.status === 401) setError(t('auth.login.invalid'));
        else setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const policyMet = passwordPolicyMet(passwordChecksOf(password));
  const submitDisabled = busy || (isRegister && !policyMet);

  const title = isRegister
    ? t('auth.dialog.register.title')
    : isForgot
      ? t('auth.dialog.forgot.title')
      : t('auth.dialog.login.title');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
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
          {isForgot ? t('auth.dialog.forgot.brief') : t('auth.dialog.brief')}
        </p>

        <div className="mb-4 mt-1 flex items-start justify-between border-b border-stone-400 pb-2">
          <h2 className="font-serif text-xl font-bold uppercase tracking-wider text-stone-900">{title}</h2>
          <button
            type="button"
            onClick={close}
            className="cursor-pointer rounded-sm px-1 font-mono text-lg leading-none text-stone-700 transition-colors hover:bg-stone-300/60 hover:text-red-800"
            title={t('auth.close')}
          >
            [✕]
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div>
            <label htmlFor="auth-email" className="font-mono text-xs uppercase tracking-wide text-stone-700">
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

          {isRegister && (
            <div>
              <label htmlFor="auth-nickname" className="font-mono text-xs uppercase tracking-wide text-stone-700">
                {t('auth.nickname')}
              </label>
              <input
                id="auth-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                minLength={3}
                maxLength={15}
                pattern="[A-Za-z0-9_.\-]{3,15}"
                autoComplete="username"
                title={t('auth.nickname.hint')}
                className="mt-1 w-full rounded-none border border-stone-500 bg-transparent px-3 py-3 font-mono text-stone-900 focus:border-stone-800 focus:outline-none focus:ring-0 md:py-2"
              />
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-fade">{t('auth.nickname.hint')}</p>
            </div>
          )}

          {!isForgot && (
            <div>
              <label htmlFor="auth-password" className="font-mono text-xs uppercase tracking-wide text-stone-700">
                {t('auth.password')}
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isRegister ? 8 : 1}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="mt-1 w-full rounded-none border border-stone-500 bg-transparent px-3 py-3 font-mono text-stone-900 focus:border-stone-800 focus:outline-none focus:ring-0 md:py-2"
              />
              {isRegister && <PasswordStrength password={password} />}
            </div>
          )}

          {error && <p className="font-mono text-sm text-red-700">{error}</p>}
          {notice && <p className="font-mono text-sm text-stone-700">{notice}</p>}

          <button
            type="submit"
            disabled={submitDisabled}
            title={isRegister && !policyMet ? t('auth.password.policyTitle') : undefined}
            className="w-full cursor-pointer rounded-none border border-stone-900 bg-stone-800 px-4 py-3 font-mono text-sm uppercase tracking-wider text-stone-100 transition-colors hover:border-red-700 hover:bg-red-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 md:py-2"
          >
            {busy
              ? '…'
              : isRegister
                ? t('auth.submit.register')
                : isForgot
                  ? t('auth.forgot.submit')
                  : t('auth.submit.login')}
          </button>
        </form>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            className="mt-3 w-full cursor-pointer text-center font-mono text-xs text-stone-700 underline transition-colors hover:text-stone-900"
          >
            {t('auth.forgot.link')}
          </button>
        )}

        <button
          type="button"
          onClick={() => switchMode(isForgot ? 'login' : isRegister ? 'login' : 'register')}
          className="mt-3 w-full cursor-pointer text-center font-mono text-xs text-stone-700 underline transition-colors hover:text-stone-900"
        >
          {isForgot
            ? t('auth.switchToLogin')
            : isRegister
              ? t('auth.switchToLogin')
              : t('auth.switchToRegister')}
        </button>
      </div>
    </div>
  );
}
