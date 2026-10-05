'use client';

import { useEffect, useState } from 'react';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth.store';
import { useI18nStore } from '@/store/i18n.store';
import { useThemeStore } from '@/store/theme.store';

/**
 * App shell header: rehydrates the persisted stores, hydrates the auth
 * session via GET /auth/me, and exposes the theme/locale/auth controls.
 */
export function Header() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const playAnonymously = useAuthStore((s) => s.playAnonymously);
  const logout = useAuthStore((s) => s.logout);

  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    void useThemeStore.persist.rehydrate();
    void useI18nStore.persist.rehydrate();
    void useAuthStore.getState().hydrate();
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
        <span className="text-lg font-bold tracking-tight">{t('app.title')}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === 'uk' ? 'en' : 'uk')}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            title={t('language.switch')}
          >
            {locale === 'uk' ? 'EN' : 'УК'}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            title={t('theme.toggle')}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>

          {status === 'loading' && <span className="text-sm text-slate-500">{t('auth.loading')}</span>}

          {status === 'anonymous' && (
            <>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t('auth.signIn')}
              </button>
              <button
                type="button"
                onClick={() => void playAnonymously()}
                className="rounded-md bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-500"
              >
                {t('auth.anonymous')}
              </button>
            </>
          )}

          {status === 'authenticated' && (
            <div className="flex items-center gap-2">
              <span className="max-w-40 truncate text-sm text-slate-600 dark:text-slate-300">
                {user?.email ?? t('auth.anonymousPlayer')}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}
