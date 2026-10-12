'use client';

import { useMemo } from 'react';
import type { Language } from '@shiftcrack/shared';
import { applySubstitution } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';
import { effectiveMapping, useFrequencyStore } from '@/store/frequency.store';
import { AnswerPanel } from '@/components/game/AnswerPanel';
import { CiphertextText } from './CiphertextText';
import { FrequencyTabs } from './FrequencyTabs';
import { SubstitutionMap } from './SubstitutionMap';

interface FrequencyPanelProps {
  ciphertext: string;
  language: Language;
  answer: string;
  onAnswerChange: (value: string) => void;
  onUseCandidate: (candidate: string) => void;
}

/**
 * Frequency analysis panel (Phase 6): the interactive ciphertext is the
 * workspace — draft/locked substitutions, n-gram cluster highlighting and
 * a right-click palette all live there. Below it the layout is two-column:
 * the substitution map on the left, the decryption report + answer form +
 * abort control opposite it on the right. The two frequency tables no
 * longer occupy the main flow — they hang on the left screen edge as
 * bookmark tabs (FrequencyTabs) and slide out only on demand.
 */
export function FrequencyPanel({
  ciphertext,
  language,
  answer,
  onAnswerChange,
  onUseCandidate,
}: FrequencyPanelProps) {
  const t = useT();
  const mapping = useFrequencyStore((s) => s.mapping);
  const candidate = useMemo(
    () => applySubstitution(ciphertext, effectiveMapping(mapping)),
    [ciphertext, mapping],
  );

  return (
    <div className="mt-3">
      <div>
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('game.ciphertext')}
        </h2>
        <div className="mt-1 border border-tan bg-inset p-3 shadow-inner">
          <CiphertextText ciphertext={ciphertext} language={language} />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-widest text-fade">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border border-tan bg-amber-200/70 dark:bg-amber-800/40" />
            {t('frequency.legend.draft')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border border-tan bg-sky-200/80 dark:bg-sky-800/50" />
            {t('frequency.legend.locked')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border border-tan bg-rose-200/80 dark:bg-rose-900/50" />
            {t('frequency.legend.ngram')}
          </span>
        </div>
      </div>

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
        <SubstitutionMap ciphertext={ciphertext} language={language} />

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
              {t('game.candidate')}
            </h2>
            <p className="mt-1 min-h-10 whitespace-pre-wrap break-words border border-dashed border-red-700 bg-card p-2 font-mono text-lg">
              {candidate}
            </p>
            <button
              type="button"
              onClick={() => onUseCandidate(candidate)}
              className="mt-1 border border-ink px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
            >
              {t('game.useCandidate')}
            </button>
          </div>

          <AnswerPanel answer={answer} onAnswerChange={onAnswerChange} />
        </div>
      </div>

      <FrequencyTabs ciphertext={ciphertext} language={language} />
    </div>
  );
}
