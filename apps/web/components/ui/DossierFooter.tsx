'use client';

import { useT } from '@/lib/i18n';

/** Bottom strip of the dossier folder: the field-manual quote. */
export function DossierFooter() {
  const t = useT();

  return (
    <footer className="flex flex-col gap-2 border-t border-tan px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-fade sm:flex-row sm:items-center sm:justify-between md:px-8">
      <span>“{t('menu.quote')}”</span>
      <span className="font-bold tracking-widest text-red-700">{t('menu.manual')}</span>
    </footer>
  );
}
