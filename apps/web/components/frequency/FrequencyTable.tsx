'use client';

import type { Language } from '@shiftcrack/shared';
import { getAlphabet, letterFrequencies } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';

/**
 * Frequency table (SDD §2): letter counts of the ciphertext, sorted
 * descending — the classic cryptanalysis starting point.
 */
export function FrequencyTable({ ciphertext, language }: { ciphertext: string; language: Language }) {
  const t = useT();
  const rows = letterFrequencies(ciphertext, getAlphabet(language));

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <h2 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800">
        {t('frequency.title')}
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-4 py-1 font-medium">{t('frequency.letter')}</th>
            <th className="px-4 py-1 font-medium">{t('frequency.count')}</th>
            <th className="px-4 py-1 font-medium">{t('frequency.percent')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ letter, count, percent }) => (
            <tr key={letter} className="border-t border-slate-100 dark:border-slate-800/60">
              <td className="px-4 py-1 font-mono text-base">{letter}</td>
              <td className="px-4 py-1">{count}</td>
              <td className="px-4 py-1">{percent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
