'use client';

import { useEffect, useState } from 'react';
import { MANUAL_SECTIONS, type ManualSectionId } from '@/lib/manual';
import { useT } from '@/lib/i18n';
import { ManualSectionView } from './ManualSectionView';

/**
 * Global "Section 9 Archives" field manual, opened from the main menu.
 * Tabbed dossier modal: one tab per cipher (frequency analysis, Caesar,
 * Vigenère, route transposition), each rendering the theory, the
 * mathematical basis and the numbered decryption algorithm.
 */
export function ManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [activeId, setActiveId] = useState<ManualSectionId>(MANUAL_SECTIONS[0]!.id);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const section = MANUAL_SECTIONS.find((entry) => entry.id === activeId) ?? MANUAL_SECTIONS[0]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_rgba(66,54,36,0.2)] md:p-6">
        <span
          aria-hidden
          className="absolute -top-3 right-2 rotate-[2deg] border-2 border-red-700 bg-paper px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-red-700"
        >
          {t('manual.stamp')}
        </span>

        <div className="flex items-start justify-between gap-3 border-b border-tan pb-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
              {t('manual.brief')}
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold uppercase tracking-wide text-ink">
              {t('manual.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('auth.close')}
            className="shrink-0 cursor-pointer border border-ink px-2 py-0.5 font-mono text-xs text-ink transition hover:bg-inset"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b-2 border-ink pb-3" role="tablist">
          {MANUAL_SECTIONS.map((entry) => {
            const selected = entry.id === activeId;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(entry.id)}
                className={
                  selected
                    ? 'cursor-pointer border-2 border-red-700 bg-red-700 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper'
                    : 'cursor-pointer border-2 border-ink px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink transition hover:border-red-700 hover:text-red-700'
                }
              >
                {t(entry.titleKey)}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <ManualSectionView section={section} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700"
        >
          {t('howto.close')}
        </button>
      </div>
    </div>
  );
}
