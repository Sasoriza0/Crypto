'use client';

import { useMemo } from 'react';
import type { Language } from '@shiftcrack/shared';
import { applySubstitution } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';
import { effectiveMapping, useFrequencyStore } from '@/store/frequency.store';
import { CiphertextText } from './CiphertextText';
import { FrequencyTable } from './FrequencyTable';
import { ReferenceFrequencies } from './ReferenceFrequencies';
import { SubstitutionMap } from './SubstitutionMap';

interface FrequencyPanelProps {
  ciphertext: string;
  language: Language;
  onUseCandidate: (candidate: string) => void;
}

/**
 * Frequency analysis panel (Phase 6): the interactive ciphertext is the
 * workspace — draft/locked substitutions, n-gram cluster highlighting and
 * a right-click palette all live there. The table, substitution map and
 * reference frequencies stay as structured side tools. The candidate is
 * the ciphertext with every mapping (draft + locked) applied.
 */
export function FrequencyPanel({ ciphertext, language, onUseCandidate }: FrequencyPanelProps) {
  const t = useT();
  const mapping = useFrequencyStore((s) => s.mapping);
  const candidate = useMemo(
    () => applySubstitution(ciphertext, effectiveMapping(mapping)),
    [ciphertext, mapping],
  );

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('game.ciphertext')}
        </h2>
        <div className="mt-2 rounded-lg bg-slate-100 p-4 dark:bg-slate-900">
          <CiphertextText ciphertext={ciphertext} language={language} />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-amber-200/70 dark:bg-amber-800/40" />
            {t('frequency.legend.draft')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-sky-200/80 dark:bg-sky-800/50" />
            {t('frequency.legend.locked')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-rose-200/80 dark:bg-rose-900/50" />
            {t('frequency.legend.ngram')}
          </span>
        </div>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('frequency.help')}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('frequency.ngramHelp')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FrequencyTable ciphertext={ciphertext} language={language} />
        <SubstitutionMap ciphertext={ciphertext} language={language} />
      </div>

      <ReferenceFrequencies language={language} />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('game.candidate')}
        </h2>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-slate-200 p-4 font-mono text-lg dark:border-slate-800">
          {candidate}
        </p>
        <button
          type="button"
          onClick={() => onUseCandidate(candidate)}
          className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('game.useCandidate')}
        </button>
      </div>
    </div>
  );
}
