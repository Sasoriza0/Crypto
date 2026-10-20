'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { ExitWarning } from '@/components/ui/ExitWarning';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth.store';
import { useGameStore } from '@/store/game.store';
import { useI18nStore } from '@/store/i18n.store';
import { useThemeStore } from '@/store/theme.store';

/**
 * Dossier header: rehydrates the persisted stores, hydrates the auth
 * session via GET /auth/me, and exposes the theme/locale/auth controls.
 *
 * Two layouts:
 *  - home (/) — the full file-cover banner: TOP SECRET stamp, serif
 *    SHIFTCRACK masthead, tagline;
 *  - anywhere else (game screens) — a single compact strip with the
 *    back-to-menu link and the controls, so no vertical space is wasted
 *    while the player works on a cipher.
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
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === '/';

  // A live game pins the UI language: the server generated the ciphertext
  // and alphabet in the session's language, so switching the locale mid-game
  // would desync the chrome from the game objects (SDD §3).
  const inGame = useGameStore((s) => s.session?.status === 'ACTIVE');

  useEffect(() => {
    void useThemeStore.persist.rehydrate();
    void useI18nStore.persist.rehydrate();
    void useAuthStore.getState().hydrate();
  }, []);

  // Back-to-menu click no longer exits instantly: an active game first gets
  // the typewriter warning, and only a confirmed exit is destructive.
  const onBackToMenu = () => {
    const game = useGameStore.getState();
    if (game.session?.status === 'ACTIVE') {
      setShowExitWarning(true);
      return;
    }
    router.push('/');
  };

  // Confirmed exit: kill any live game first (POST …/abandon), so a session
  // never hangs on the server while the player browses the menu.
  const onConfirmExit = async () => {
    if (leaving) return;
    const game = useGameStore.getState();
    if (game.session?.status === 'ACTIVE') {
      setLeaving(true);
      try {
        await game.abandon();
      } catch {
        // best effort: even if the server call failed, the game must end
      } finally {
        useGameStore.getState().reset();
        setLeaving(false);
      }
    }
    setShowExitWarning(false);
    router.push('/');
  };

  const controlClass =
    'rounded-none border border-ink px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset disabled:opacity-50';

  const controls = (
    <>
      <button
        type="button"
        onClick={() => setLocale(locale === 'uk' ? 'en' : 'uk')}
        disabled={inGame}
        className={`${controlClass} disabled:cursor-not-allowed`}
        title={inGame ? t('language.locked') : t('language.switch')}
      >
        {locale === 'uk' ? 'EN' : 'УК'}
      </button>

      <button type="button" onClick={toggleTheme} className={controlClass} title={t('theme.toggle')}>
        {theme === 'light' ? '☾' : '☀'}
      </button>

      {status === 'loading' && <span className="font-mono text-xs uppercase tracking-widest text-fade">{t('auth.loading')}</span>}

      {status === 'anonymous' && (
        <>
          <button type="button" onClick={() => setAuthOpen(true)} className={controlClass}>
            {t('auth.signIn')}
          </button>
          <button
            type="button"
            onClick={() => void playAnonymously()}
            className="border-2 border-ink bg-ink px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-paper transition hover:border-red-700 hover:bg-red-700"
          >
            {t('auth.anonymous')}
          </button>
        </>
      )}

      {status === 'authenticated' && (
        <div className="flex items-center gap-2">
          <span className="max-w-40 truncate font-mono text-xs uppercase tracking-widest text-fade">
            {user?.nickname ?? user?.email ?? t('auth.anonymousPlayer')}
          </span>
          <button type="button" onClick={() => void logout()} className={controlClass}>
            {t('auth.logout')}
          </button>
        </div>
      )}
    </>
  );

  if (!isHome) {
    return (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={onBackToMenu}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fade transition hover:text-red-700"
        >
          ← {t('common.back')}
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">{controls}</div>
        <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
        <ExitWarning
          open={showExitWarning}
          busy={leaving}
          onCancel={() => setShowExitWarning(false)}
          onConfirm={() => void onConfirmExit()}
        />
      </header>
    );
  }

  return (
    <header className="relative border-b-2 border-ink px-4 py-4 text-center md:px-8 md:py-6">
      {/* Absolute stamp: its width (locale-dependent text) never affects
          the header flow, so switching languages cannot shift the layout. */}
      <div className="pointer-events-none absolute right-2 top-2 rotate-[-12deg] whitespace-nowrap border-2 border-red-700 px-3 py-1 font-mono text-[10px] font-bold tracking-[0.24em] text-red-700 sm:-right-8 sm:-top-6 md:-right-12">
        {t('header.topSecret')}
      </div>

      <MetaLabel>{t('header.meta')}</MetaLabel>
      <h1 className="mt-3 font-serif text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl md:text-6xl">
        {t('app.title')}
      </h1>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-fade md:text-[11px]">
        {t('header.tagline')}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-tan pt-5">
        {controls}
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}
