'use client';

import { useEffect, useState } from 'react';
import type { CipherModule } from '@shiftcrack/shared';
import { useT } from '@/lib/i18n';

/**
 * Compact "how to play" control: a small retro button next to the status
 * strip that opens the module's control instructions in a paper dossier
 * modal. The open instruction texts were removed from the panels to save
 * vertical space — they live here, one click away.
 */

const INSTRUCTION_KEYS: Record<CipherModule, string[]> = {
  CAESAR: ['caesar.help'],
  TRANSPOSITION: ['transposition.help', 'transposition.highlightHint'],
  FREQUENCY: ['frequency.help', 'frequency.ngramHelp'],
  VIGENERE: ['vigenere.help'],
  CHIMERA: ['chimera.help'],
};

export function HowToPlay({ module }: { module: CipherModule }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-tan px-3 py-2 font-mono text-sm text-fade transition hover:bg-inset hover:text-ink md:w-auto md:py-1"
      >
        ? {t('howto.button')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-md border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_rgba(66,54,36,0.2)]">
            <div className="flex items-start justify-between border-b border-tan pb-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-red-700">
                {t('howto.title')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('howto.close')}
                className="border border-ink px-2 py-0.5 font-mono text-xs text-ink transition hover:bg-inset"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {INSTRUCTION_KEYS[module].map((key) => (
                <p key={key} className="font-serif text-sm leading-6 text-fade-dark">
                  {t(key)}
                </p>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 inline-flex items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700"
            >
              {t('howto.close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
