'use client';

import { useMemo, useState } from 'react';

/**
 * Letter histogram (Phase 6): a bar chart over the full alphabet (fixed
 * axis order, so reference and ciphertext charts line up letter-for-letter
 * and peaks can be compared visually). All charts inside one panel share
 * the same `scaleMax`, so a 9% peak is as tall in both charts. The tallest
 * bar gets a marker ring; hovering a column shows the exact share.
 */

export interface LetterHistogramProps {
  title: string;
  alphabet: string;
  /** letter → percent (0..100); missing letters render as zero. */
  values: Record<string, number>;
  /** letter → absolute count, shown in the tooltip when present. */
  counts?: Record<string, number>;
  /** Shared scale top across companion charts (percent). */
  scaleMax: number;
  accent: 'emerald' | 'sky';
}

const COL_WIDTH = 20;

const ACCENTS = {
  emerald: 'bg-tan',
  sky: 'bg-red-700',
} as const;

export function LetterHistogram({ title, alphabet, values, counts, scaleMax, accent }: LetterHistogramProps) {
  const [hovered, setHovered] = useState<string | null>(null);

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

  const barClass = ACCENTS[accent];

  return (
    <div className="w-full min-w-0 border border-tan bg-card">
      <h3 className="border-b border-tan px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
        {title}
      </h3>
      <div className="w-full overflow-x-auto overflow-y-hidden p-3">
        <div className="mx-auto" style={{ width: letters.length * COL_WIDTH }}>
          <div className="flex h-24 items-end">
            {letters.map((letter) => {
              const percent = values[letter] ?? 0;
              const count = counts?.[letter];
              const tooltip = `${letter}: ${percent.toFixed(1)}%${count !== undefined ? ` (${count})` : ''}`;
              return (
                <div
                  key={letter}
                  title={tooltip}
                  onMouseEnter={() => setHovered(letter)}
                  onMouseLeave={() => setHovered(null)}
                  className="flex h-full flex-1 items-end justify-center"
                  style={{ minWidth: COL_WIDTH }}
                >
                  <div
                    className={`w-3/5 transition-opacity ${barClass} ${
                      hovered === letter ? 'opacity-100' : 'opacity-80'
                    } ${maxLetter === letter ? 'ring-2 ring-red-700' : ''}`}
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
                className="flex-1 text-center font-mono text-[10px] text-fade"
                style={{ minWidth: COL_WIDTH }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
