'use client';

import { useState } from 'react';
import type { Language } from '@shiftcrack/shared';
import { getFrequencyTable } from '@shiftcrack/shared';
import { useT } from '@/lib/i18n';

/**
 * Collapsible reference panel (Phase 5 UX): the standard letter frequencies
 * of the selected language, from the same shared table the server uses, so
 * players can compare them against the ciphertext frequencies.
 */
export function ReferenceFrequencies({ language }: { language: Language }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const rows = Object.entries(getFrequencyTable(language))
    .map(([letter, frequency]) => ({ letter, percent: frequency * 100 }))
    .sort((a, b) => b.percent - a.percent);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-semibold"
      >
        {t('frequency.reference.title')}
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="px-4 py-1 font-medium">{t('frequency.letter')}</th>
                <th className="px-4 py-1 font-medium">{t('frequency.percent')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ letter, percent }) => (
                <tr key={letter} className="border-t border-slate-100 dark:border-slate-800/60">
                  <td className="px-4 py-1 font-mono text-base">{letter}</td>
                  <td className="px-4 py-1">{percent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
