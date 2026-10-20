'use client';

import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import type { ManualSection } from '@/lib/manual';

/**
 * One field-manual section: the cipher's title with its mission stamp,
 * the theory paragraph, the mathematical/logical basis (red-margin insert)
 * and the numbered decryption algorithm. Shared by the global manual and
 * the compact in-game cipher reference.
 */
export function ManualSectionView({ section }: { section: ManualSection }) {
  const t = useT();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
        <h3 className="font-serif text-xl font-bold uppercase tracking-wide text-ink md:text-2xl">
          {t(section.titleKey)}
        </h3>
        <span className="mt-1 shrink-0 rotate-[-2deg] border border-red-700 px-2 py-1 font-mono text-[9px] font-bold tracking-wider text-red-700">
          {t(section.missionKey)}
        </span>
      </div>

      <div>
        <MetaLabel>{t('manual.theory')}</MetaLabel>
        <p className="mt-2 font-serif text-sm leading-6 text-fade-dark">{t(section.theoryKey)}</p>
      </div>

      <div>
        <MetaLabel>{t('manual.math')}</MetaLabel>
        <p className="mt-2 border-l-4 border-red-700 bg-inset px-3 py-2 font-mono text-xs leading-5 text-fade-dark">
          {t(section.mathKey)}
        </p>
      </div>

      <div>
        <MetaLabel>{t('manual.steps')}</MetaLabel>
        <ol className="mt-2 space-y-2">
          {section.stepKeys.map((key, index) => (
            <li key={key} className="flex gap-3 font-mono text-xs leading-5 text-fade-dark">
              <span className="shrink-0 font-bold text-red-700">{String(index + 1).padStart(2, '0')}</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
