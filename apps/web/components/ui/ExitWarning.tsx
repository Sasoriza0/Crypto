'use client';

import { useEffect } from 'react';
import { useT } from '@/lib/i18n';

interface ExitWarningProps {
  open: boolean;
  /** True while the abandon request is in flight. */
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Retro exit-warning modal (Phase 5/6 UX): intercepting the back-to-menu
 * click before any session is destroyed. Styled as a typewriter-issued
 * secret warning: darkened screen (no blur), sharp-cornered paper card,
 * thick ink border, red serif masthead and mono dossier text.
 */
export function ExitWarning({ open, busy, onCancel, onConfirm }: ExitWarningProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onCancel()} />

      <div className="relative w-full max-w-md border-2 border-stone-800 bg-paper p-6 shadow-xl">
        <h2 className="font-serif text-xl font-bold uppercase leading-tight tracking-wide text-red-700">
          {t('exit.title')}
        </h2>

        <div className="mt-3 border-t border-stone-800" />

        <p className="mt-4 font-mono text-sm leading-6 text-ink">{t('exit.warning')}</p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="border border-stone-800 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-stone-800 transition hover:bg-inset disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('exit.stay')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="border border-red-700 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-red-700 transition hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('exit.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
