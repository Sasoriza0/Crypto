'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@shiftcrack/shared';
import { getAlphabet } from '@/lib/ciphers';
import { useT } from '@/lib/i18n';
import { conflictingCiphers, useFrequencyStore } from '@/store/frequency.store';

/**
 * Interactive ciphertext (Phase 6): the main workspace of the frequency
 * module. Every letter is a cell showing the guessed plaintext glyph above
 * the original cipher glyph. Workflow:
 *  - click a letter → it becomes the active cell; typing a letter sets a
 *    DRAFT (amber, semi-transparent), Enter LOCKs it (bright sky),
 *    Backspace clears it; clicking the active letter toggles lock;
 *  - right-click a letter → quick palette of the alphabet (draft picks);
 *  - drag across 2–4 adjacent letters → the system highlights every
 *    identical cluster across the whole text (rose);
 *  - ← → move the active cell between letters, Escape deselects.
 * Cells whose plain letter is assigned to two ciphers at once get a red
 * conflict marker.
 */

interface CiphertextTextProps {
  ciphertext: string;
  language: Language;
}

const MAX_NGRAM = 4;

function findOccurrences(text: string, pattern: string): Array<[number, number]> {
  const lower = text.toLowerCase();
  const starts: number[] = [];
  for (let i = 0; i <= lower.length - pattern.length; i++) {
    if (lower.startsWith(pattern, i)) starts.push(i);
  }
  return starts.map((start) => [start, start + pattern.length - 1]);
}

export function CiphertextText({ ciphertext, language }: CiphertextTextProps) {
  const t = useT();
  const alphabet = useMemo(() => getAlphabet(language), [language]);
  const letters = useMemo(() => ciphertext.split(''), [ciphertext]);

  const mapping = useFrequencyStore((s) => s.mapping);
  const setDraft = useFrequencyStore((s) => s.setDraft);
  const lockLetter = useFrequencyStore((s) => s.lockLetter);
  const unlockLetter = useFrequencyStore((s) => s.unlockLetter);
  const clearLetter = useFrequencyStore((s) => s.clearLetter);

  const conflicts = useMemo(() => conflictingCiphers(mapping), [mapping]);

  // Words as index ranges: spaces become word separators (rendered as gaps),
  // every letter keeps its absolute ciphertext index for the interactions.
  const words = useMemo(() => {
    const out: { start: number; end: number }[] = [];
    let i = 0;
    while (i < letters.length) {
      if (letters[i] === ' ') {
        i++;
        continue;
      }
      const start = i;
      while (i < letters.length && letters[i] !== ' ') i++;
      out.push({ start, end: i - 1 });
    }
    return out;
  }, [letters]);

  const [selected, setSelected] = useState<number | null>(null);
  const [ngram, setNgram] = useState<{ start: number; end: number } | null>(null);
  const [palette, setPalette] = useState<{ idx: number; x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; anchor: number; last: number } | null>(null);

  // New session → clean workspace.
  useEffect(() => {
    setSelected(null);
    setNgram(null);
    setPalette(null);
  }, [ciphertext]);

  const pattern = useMemo(() => {
    if (!ngram || ngram.start === ngram.end) return null;
    return letters.slice(ngram.start, ngram.end + 1).join('').toLowerCase();
  }, [ngram, letters]);

  const occurrences = useMemo(
    () => (pattern ? findOccurrences(ciphertext, pattern) : []),
    [pattern, ciphertext],
  );

  const occurrenceIndices = useMemo(() => {
    const set = new Set<number>();
    for (const [start, end] of occurrences) {
      for (let i = start; i <= end; i++) set.add(i);
    }
    return set;
  }, [occurrences]);

  const sourceIndices = useMemo(() => {
    if (!ngram) return null;
    const set = new Set<number>();
    for (let i = ngram.start; i <= ngram.end; i++) set.add(i);
    return set;
  }, [ngram]);

  const indexAt = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const cell = el?.closest?.('[data-idx]') as HTMLElement | null;
    if (!cell) return null;
    const idx = Number(cell.dataset.idx);
    return Number.isNaN(idx) ? null : idx;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const idx = indexAt(event.clientX, event.clientY);
    if (idx === null) {
      setSelected(null);
      setNgram(null);
      setPalette(null);
      return;
    }
    containerRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, anchor: idx, last: idx };
    setSelected(null);
    setPalette(null);
    setNgram({ start: idx, end: idx });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const idx = indexAt(event.clientX, event.clientY);
    if (idx === null || idx === drag.last) return;
    if (Math.abs(idx - drag.last) !== 1) return; // contiguous run only
    if (!alphabet.includes(letters[idx]!)) return; // letters only
    if (Math.abs(drag.anchor - idx) + 1 > MAX_NGRAM) return; // cap the cluster
    drag.last = idx;
    setNgram({ start: Math.min(drag.anchor, idx), end: Math.max(drag.anchor, idx) });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    const start = Math.min(drag.anchor, drag.last);
    const end = Math.max(drag.anchor, drag.last);
    if (start === end) {
      setNgram(null);
      const ch = letters[start];
      if (!ch || !alphabet.includes(ch)) return;
      if (selected === start) {
        const entry = mapping[ch];
        if (entry && !entry.locked) lockLetter(ch);
        else if (entry?.locked) unlockLetter(ch);
      }
      setSelected(start);
      return;
    }
    setSelected(null);
    setNgram({ start, end });
  };

  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const idx = indexAt(event.clientX, event.clientY);
    if (idx === null) return;
    const ch = letters[idx];
    if (!ch || !alphabet.includes(ch)) return;
    event.preventDefault();
    setSelected(idx);
    setPalette({ idx, x: event.clientX, y: event.clientY });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setSelected(null);
      setNgram(null);
      setPalette(null);
      return;
    }
    if (selected === null) return;
    const ch = letters[selected];
    if (!ch) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      lockLetter(ch);
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      clearLetter(ch);
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      let next = selected + direction;
      while (next >= 0 && next < letters.length && !alphabet.includes(letters[next]!)) next += direction;
      if (next >= 0 && next < letters.length) setSelected(next);
      return;
    }
    if (event.key.length === 1 && alphabet.includes(event.key.toLowerCase())) {
      event.preventDefault();
      setDraft(ch, event.key.toLowerCase());
    }
  };

  const paletteLetter = palette ? letters[palette.idx] : null;

  return (
    <>
      <div
        ref={containerRef}
        className="flex flex-wrap select-none gap-x-8 gap-y-0.5 font-mono outline-none md:gap-y-1"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={onContextMenu}
        style={{ touchAction: 'none' }}
      >
        {words.map(({ start, end }) => (
          <div key={start} className="flex flex-wrap gap-0">
            {letters.slice(start, end + 1).map((ch, offset) => {
              const idx = start + offset;
              const isLetter = alphabet.includes(ch);
              if (!isLetter) {
                return (
                  <span
                    key={idx}
                    data-idx={idx}
                    className="flex h-10 w-6 shrink-0 items-center justify-center text-sm text-fade md:h-14 md:text-lg"
                  >
                    {ch}
                  </span>
                );
              }
              const entry = mapping[ch];
              const isSource = sourceIndices?.has(idx) ?? false;
              const isOccurrence = !isSource && occurrenceIndices.has(idx);
              const conflict = conflicts.has(ch) && entry;
              const cellClass = isSource
                ? 'bg-rose-400/60 dark:bg-rose-700/60'
                : isOccurrence
                  ? 'bg-rose-200/60 dark:bg-rose-900/40'
                  : entry?.locked
                    ? 'bg-sky-200/60 dark:bg-sky-800/50'
                    : entry
                      ? 'bg-amber-200/50 dark:bg-amber-800/30'
                      : '';
              const plainClass = entry
                ? entry.locked
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-amber-700 dark:text-amber-400'
                : 'text-transparent';
              return (
                <span
                  key={idx}
                  data-idx={idx}
                  className={`flex h-10 w-8 shrink-0 cursor-pointer flex-col items-center justify-center leading-none md:h-14 ${cellClass} ${
                    selected === idx ? 'ring-2 ring-red-700' : ''
                  }`}
                >
                  <span
                    className={`text-base font-semibold md:text-xl ${
                      conflict ? 'text-red-600 underline decoration-dotted dark:text-red-400' : plainClass
                    }`}
                  >
                    {entry ? entry.plain : '\u00A0'}
                  </span>
                  <span className="text-sm text-fade md:text-base">{ch}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {pattern && (
        <p className="mt-1 font-mono text-xs text-red-700">
          {t('frequency.ngramCount', { count: occurrences.length })}
        </p>
      )}

      {palette && paletteLetter && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPalette(null)} />
          <div
            className="fixed z-50 w-60 border border-tan bg-paper p-2 shadow-[4px_4px_0_rgba(66,54,36,0.16)]"
            style={{
              left: Math.min(palette.x, window.innerWidth - 250),
              top: Math.min(palette.y, window.innerHeight - 380),
            }}
          >
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-fade">
              «{paletteLetter}» → {t('frequency.palette.title')}
            </div>
            <div className="flex flex-wrap gap-1">
              {alphabet.split('').map((plain) => (
                <button
                  key={plain}
                  type="button"
                  onClick={() => {
                    setDraft(paletteLetter, plain);
                    setPalette(null);
                  }}
                  className="h-8 w-8 border border-tan bg-transparent font-mono text-base text-ink transition hover:border-red-700 hover:text-red-700"
                >
                  {plain}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  lockLetter(paletteLetter);
                  setPalette(null);
                }}
                className="flex-1 border border-ink px-2 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
              >
                {t('frequency.mapping.lock')}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearLetter(paletteLetter);
                  setPalette(null);
                }}
                className="flex-1 border border-ink px-2 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
              >
                {t('frequency.mapping.clear')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
