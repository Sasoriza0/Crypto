'use client';

import { useEffect, useState } from 'react';
import type { CipherModule } from '@shiftcrack/shared';
import { useT } from '@/lib/i18n';
import { manualSectionForModule } from '@/lib/manual';
import { ManualSectionView } from './ManualSectionView';

/**
 * In-game cipher reference: a compact dossier button next to the status
 * strip that opens the field-manual excerpt for the CURRENT module —
 * theory, basis and the decryption algorithm — without leaving the
 * mission. Modules without a manual section (CHIMERA) render nothing.
 */
export function CipherReference({ module }: { module: CipherModule }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const section = manualSectionForModule(module);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!section) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-tan px-3 py-2 font-mono text-sm text-fade transition hover:bg-inset hover:text-ink md:w-auto md:py-1"
      >
        § {t('manual.inGame.button')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_rgba(66,54,36,0.2)] md:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-tan pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
                  {t('manual.inGame.brief')}
                </p>
                <h2 className="mt-1 font-serif text-xl font-bold uppercase tracking-wide text-ink">
                  {t('manual.inGame.title')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('auth.close')}
                className="shrink-0 cursor-pointer border border-ink px-2 py-0.5 font-mono text-xs text-ink transition hover:bg-inset"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              <ManualSectionView section={section} />
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
