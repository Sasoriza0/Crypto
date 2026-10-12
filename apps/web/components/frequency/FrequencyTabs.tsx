'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@shiftcrack/shared';
import { getFrequencyTable } from '@shiftcrack/shared';
import { getAlphabet, letterFrequencies } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';

type TabId = 'text' | 'reference';

interface DrawerBarsProps {
  title: string;
  alphabet: string;
  /** letter → percent (0..100); missing letters render as zero. */
  values: Record<string, number>;
  /** letter → absolute count, shown in the tooltip when present. */
  counts?: Record<string, number>;
  scaleMax: number;
  accent: 'emerald' | 'sky';
}

/**
 * Compact fluid histogram for the drawer: unlike the full-width
 * LetterHistogram, the columns flex to the panel width (no fixed 20px
 * cells), so the whole alphabet fits without horizontal scrolling. The
 * tallest bar gets a red ring and hovering a column shows the exact share.
 */
function DrawerBars({ title, alphabet, values, counts, scaleMax, accent }: DrawerBarsProps) {
  const letters = useMemo(() => alphabet.split(''), [alphabet]);
  const maxLetter = useMemo(() => {
    let best: string | null = null;
    let bestValue = -1;
    for (const letter of letters) {
      const value = values[letter] ?? 0;
      if (value > bestValue) {
        bestValue = value;
        best = letter;
      }
    }
    return best;
  }, [letters, values]);

  const barClass = accent === 'emerald' ? 'bg-tan' : 'bg-red-700';

  return (
    <div className="border border-tan bg-card">
      <h3 className="border-b border-tan px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
        {title}
      </h3>
      <div className="p-2">
        <div className="flex h-32 items-end gap-px">
          {letters.map((letter) => {
            const percent = values[letter] ?? 0;
            const count = counts?.[letter];
            return (
              <div
                key={letter}
                title={`${letter}: ${percent.toFixed(1)}%${count !== undefined ? ` (${count})` : ''}`}
                className="flex h-full flex-1 items-end justify-center"
              >
                <div
                  className={`w-full ${barClass} ${maxLetter === letter ? 'ring-1 ring-red-700' : ''}`}
                  style={{ height: `${Math.max(0, (percent / scaleMax) * 100)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex">
          {letters.map((letter) => (
            <div
              key={letter}
              className="flex-1 text-center font-mono text-[8px] leading-none text-fade"
            >
              {letter}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Frequency bookmarks (Phase 6 layout): the two frequency tables left the
 * main document flow and hang on the left edge of the screen as paper
 * bookmark tabs. Clicking a tab slides out a full-height dossier drawer
 * (vintage paper, strict stone border, big shadow) with the corresponding
 * histogram plus the raw table. The drawer is a pure overlay — the game
 * board never moves — and closes via the ✕ button, a click on the active
 * tab, Escape, or any click outside the panel.
 */
export function FrequencyTabs({ ciphertext, language }: { ciphertext: string; language: Language }) {
  const t = useT();
  const [active, setActive] = useState<TabId | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const alphabet = getAlphabet(language);

  const textRows = useMemo(() => letterFrequencies(ciphertext, alphabet), [ciphertext, alphabet]);
  const referenceRows = useMemo(
    () =>
      Object.entries(getFrequencyTable(language))
        .map(([letter, frequency]) => ({ letter, percent: frequency * 100 }))
        .sort((a, b) => b.percent - a.percent),
    [language],
  );

  const textValues = useMemo(
    () => Object.fromEntries(textRows.map((row) => [row.letter, row.percent])),
    [textRows],
  );
  const textCounts = useMemo(
    () => Object.fromEntries(textRows.map((row) => [row.letter, row.count])),
    [textRows],
  );
  const referenceValues = useMemo(
    () => Object.fromEntries(referenceRows.map((row) => [row.letter, row.percent])),
    [referenceRows],
  );

  const textScale = useMemo(
    () => Math.max(1, ...textRows.map((row) => row.percent)),
    [textRows],
  );
  const referenceScale = useMemo(
    () => Math.max(1, ...referenceRows.map((row) => row.percent)),
    [referenceRows],
  );

  // Close on Escape or on any click outside the drawer (tabs included).
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setActive(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);

  const toggle = (tab: TabId) => setActive((current) => (current === tab ? null : tab));

  const tabClass = (tab: TabId) =>
    `border border-tan px-1.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] [writing-mode:vertical-rl] transition ${
      active === tab
        ? 'border-red-700 border-r-0 bg-paper text-red-700'
        : 'bg-card text-fade shadow-[-2px_2px_0_rgba(66,54,36,0.08)] hover:text-ink'
    }`;

  const headerCell = 'px-3 py-1 text-left font-mono text-xs uppercase tracking-widest text-fade';
  const bodyCell = 'px-3 py-1 font-mono text-ink';

  return (
    <div ref={rootRef} className="fixed left-0 top-0 z-50 flex h-full items-center">
      {/* Protruding paper bookmark tabs pinned to the left edge */}
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => toggle('text')} className={tabClass('text')}>
          {t('frequency.tabs.text')}
        </button>
        <button type="button" onClick={() => toggle('reference')} className={tabClass('reference')}>
          {t('frequency.reference.title')}
        </button>
      </div>

      {/* Full-height sliding dossier drawer */}
      <div
        aria-hidden={!active}
        inert={!active}
        className={`h-full overflow-hidden transition-[max-width,opacity] duration-300 ease-out ${
          active ? 'max-w-[420px] opacity-100' : 'max-w-0 opacity-0'
        }`}
      >
        <div className="flex h-full w-[420px] max-w-[88vw] flex-col border-y border-r border-stone-400 bg-paper shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between border-b border-stone-400 px-4 py-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-red-700">
              {active === 'text' ? t('frequency.tabs.text') : t('frequency.reference.title')}
            </span>
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label={t('frequency.tabs.close')}
              className="border border-ink px-2 py-0.5 font-mono text-xs leading-none text-ink transition hover:bg-inset"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {active === 'text' && (
              <>
                <DrawerBars
                  title={t('caesar.cipherHistogram')}
                  alphabet={alphabet}
                  values={textValues}
                  counts={textCounts}
                  scaleMax={textScale}
                  accent="sky"
                />
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr>
                      <th className={headerCell}>{t('frequency.letter')}</th>
                      <th className={headerCell}>{t('frequency.count')}</th>
                      <th className={headerCell}>{t('frequency.percent')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tan/60">
                    {textRows.map(({ letter, count, percent }) => (
                      <tr key={letter}>
                        <td className={`${bodyCell} text-base`}>{letter}</td>
                        <td className={bodyCell}>{count}</td>
                        <td className={bodyCell}>{percent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {active === 'reference' && (
              <>
                <DrawerBars
                  title={t('caesar.referenceHistogram')}
                  alphabet={alphabet}
                  values={referenceValues}
                  scaleMax={referenceScale}
                  accent="emerald"
                />
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr>
                      <th className={headerCell}>{t('frequency.letter')}</th>
                      <th className={headerCell}>{t('frequency.percent')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tan/60">
                    {referenceRows.map(({ letter, percent }) => (
                      <tr key={letter}>
                        <td className={`${bodyCell} text-base`}>{letter}</td>
                        <td className={bodyCell}>{percent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
