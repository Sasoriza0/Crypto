'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Route grid (Phase 6): the ciphertext reflows row-major into a fluid
 * cols×rows matrix. The player:
 *  - drags the bottom-right corner to resize the column count — right/down
 *    grows it, left/up shrinks it (the letters reflow live; a perfect
 *    rectangle — no ragged last row — means the column count divides the
 *    ciphertext length),
 *  - clicks any letter to highlight every occurrence of it in the grid,
 *  - drags across cells to trace a route (word-search style) and read the
 *    letters along the path; the traced text becomes the candidate.
 *
 * The grid always fits inside 65vh: cells are square but shrink
 * proportionally with the row count (hard-capped at 48px), so the whole
 * matrix stays on one screen without vertical scrolling.
 */

interface RouteGridProps {
  ciphertext: string;
  /** Plaintext length from session meta — trims the letter padding. */
  textLength?: number;
  onCandidateChange?: (candidate: string) => void;
}

const MIN_COLS = 2;
const MAX_COLS = 20;
/** Approximate pixels (dx + dy) per column for the corner-drag feel. */
const DRAG_COL_PX = 22;
/** Hard cell cap (px) — matches the max-w-12/max-h-12 classes below. */
const MAX_CELL_PX = 48;
/** Container width cap (mirrors the old max-w-2xl). */
const MAX_GRID_W = 672;
/** The grid may use at most this fraction of the viewport height (no scroll). */
const GRID_H_FRACTION = 0.65;

function initialCols(length: number): number {
  // Near-square grids are the classic route-cipher starting point.
  return Math.max(3, Math.min(MAX_COLS, Math.round(Math.sqrt(length))));
}

export function RouteGrid({ ciphertext, textLength, onCandidateChange }: RouteGridProps) {
  const t = useT();
  const cells = useMemo(() => ciphertext.split(''), [ciphertext]);

  const [cols, setCols] = useState(() => initialCols(ciphertext.length));
  const [highlightedLetter, setHighlightedLetter] = useState<string | null>(null);
  const [trace, setTraceState] = useState<number[]>([]);
  const [draggingCorner, setDraggingCorner] = useState(false);
  const [viewportH, setViewportH] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const traceRef = useRef<number[]>([]);
  const tracePointerRef = useRef<number | null>(null);
  const lastCellRef = useRef<number>(-1);
  const resizeRef = useRef<{ pointerId: number; startX: number; startY: number; startCols: number } | null>(null);

  const setTrace = (next: number[]) => {
    traceRef.current = next;
    setTraceState(next);
  };

  const rows = Math.ceil(cells.length / cols);
  const perfectRectangle = cells.length % cols === 0;

  // Track the viewport height so the grid can always fit on one screen.
  useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Square cells sized so the whole grid fits inside 65vh: the height
  // budget is split across the rows, minus gaps/border/padding overhead.
  // Fewer columns -> more rows -> proportionally smaller cells, no scroll.
  const cellPx = (() => {
    if (viewportH === null) return MAX_CELL_PX;
    const budget = Math.max(1, Math.floor(viewportH * GRID_H_FRACTION) - rows - 4);
    return Math.min(MAX_CELL_PX, Math.max(1, Math.floor(budget / rows)));
  })();
  const denseCells = cellPx < 26;

  const tracedText = useMemo(
    () => trace.map((cell) => cells[cell] ?? '').join(''),
    [trace, cells],
  );
  const candidate = useMemo(
    () => tracedText.slice(0, textLength ?? ciphertext.length),
    [tracedText, textLength, ciphertext.length],
  );

  // New session → fresh grid.
  useEffect(() => {
    setCols(initialCols(ciphertext.length));
    setHighlightedLetter(null);
    setTrace([]);
  }, [ciphertext]);

  useEffect(() => {
    onCandidateChange?.(candidate);
  }, [candidate, onCandidateChange]);

  // ---------------------------------------------------------------------
  // Trace + click-to-highlight (pointer events on the grid container)
  // ---------------------------------------------------------------------

  const cellIndexAt = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const cellEl = el?.closest?.('[data-cell]') as HTMLElement | null;
    if (!cellEl) return null;
    const idx = Number(cellEl.dataset.cell);
    return Number.isNaN(idx) ? null : idx;
  };

  const onGridPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const cellEl = (event.target as HTMLElement).closest?.('[data-cell]') as HTMLElement | null;
    if (!cellEl) return;
    const idx = Number(cellEl.dataset.cell);
    if (Number.isNaN(idx)) return;
    containerRef.current?.setPointerCapture(event.pointerId);
    tracePointerRef.current = event.pointerId;
    lastCellRef.current = idx;
    setTrace([idx]);
  };

  const onGridPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tracePointerRef.current !== event.pointerId) return;
    const idx = cellIndexAt(event.clientX, event.clientY);
    if (idx === null || idx === lastCellRef.current) return;
    lastCellRef.current = idx;
    const current = traceRef.current;
    const position = current.indexOf(idx);
    setTrace(position === -1 ? [...current, idx] : current.slice(0, position + 1));
  };

  const onGridPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tracePointerRef.current !== event.pointerId) return;
    tracePointerRef.current = null;
    const current = traceRef.current;
    if (current.length === 1) {
      // A stationary press on one cell = click → toggle letter highlight.
      const ch = cells[current[0]!];
      if (ch && ch !== ' ') {
        setHighlightedLetter((prev) => (prev === ch ? null : ch));
      }
      setTrace([]);
    }
  };

  // ---------------------------------------------------------------------
  // Corner drag-to-resize
  // ---------------------------------------------------------------------

  const onCornerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startCols: cols };
    setDraggingCorner(true);
  };

  const onCornerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || event.pointerId !== resize.pointerId) return;
    // Right/down grows the column count, left/up shrinks it.
    const deltaPx = event.clientX - resize.startX + (event.clientY - resize.startY);
    const deltaCols = Math.round(deltaPx / DRAG_COL_PX);
    const next = Math.min(MAX_COLS, Math.max(MIN_COLS, resize.startCols + deltaCols));
    if (next !== cols) {
      setCols(next);
      setTrace([]); // dimensions changed → the old path is meaningless
    }
  };

  const onCornerPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    setDraggingCorner(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = Math.min(MAX_COLS, cols + 1);
      setCols(next);
      setTrace([]);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = Math.max(MIN_COLS, cols - 1);
      setCols(next);
      setTrace([]);
    }
  };

  // ---------------------------------------------------------------------

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-widest text-fade">
        <span>
          {t('transposition.columns')}: <strong className="text-ink">{cols}</strong>
        </span>
        <span>
          {t('transposition.rows')}: <strong className="text-ink">{rows}</strong>
        </span>
        <span>
          {t('transposition.letters')}: {cells.length}
        </span>
        {perfectRectangle && (
          <span className="rotate-[-2deg] border border-red-700 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-700">
            {t('transposition.perfect')}
          </span>
        )}
        <span>
          {t('transposition.traceCount', { count: trace.length })}
        </span>
        {trace.length > 0 && (
          <button
            type="button"
            onClick={() => setTrace([])}
            className="border border-ink px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
          >
            {t('transposition.traceClear')}
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className={`relative mx-auto w-full select-none outline-none ${
          draggingCorner ? 'cursor-nwse-resize' : ''
        }`}
        style={{
          touchAction: 'none',
          maxWidth: Math.min(MAX_GRID_W, cols * cellPx),
        }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onGridPointerDown}
        onPointerMove={onGridPointerMove}
        onPointerUp={onGridPointerUp}
        onPointerCancel={onGridPointerUp}
      >
        <div className="max-h-[65vh] overflow-hidden">
          <div
            className="grid gap-px border border-ink bg-ink p-px"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {cells.map((ch, idx) => {
              const isSpace = ch === ' ';
              const tracedAt = trace.indexOf(idx);
              const traced = tracedAt !== -1;
              const highlighted = !isSpace && !traced && highlightedLetter === ch;
              return (
                <button
                  key={idx}
                  type="button"
                  tabIndex={-1}
                  data-cell={idx}
                  className={`relative flex aspect-square max-h-12 max-w-12 items-center justify-center font-mono focus:outline-none ${
                    denseCells ? 'text-[10px]' : 'text-sm sm:text-base'
                  } ${
                    traced
                      ? 'bg-red-700 text-white'
                      : highlighted
                        ? 'bg-tan text-ink'
                        : isSpace
                          ? 'bg-card text-fade'
                          : 'bg-inset text-ink'
                  }`}
                >
                  <span>{isSpace ? '·' : ch}</span>
                  {traced && (
                    <span
                      className={`absolute right-0.5 top-0 font-semibold leading-none text-white ${
                        denseCells ? 'text-[6px]' : 'text-[9px]'
                      }`}
                    >
                      {tracedAt + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Corner grip — drag to resize the column count */}
        <div
          className="absolute -bottom-2 -right-2 flex h-6 w-6 cursor-nwse-resize items-end justify-end border border-tan bg-ink p-0.5"
          onPointerDown={onCornerPointerDown}
          onPointerMove={onCornerPointerMove}
          onPointerUp={onCornerPointerEnd}
          onPointerCancel={onCornerPointerEnd}
        >
          <span className="text-[10px] leading-none text-paper">▘</span>
        </div>
      </div>
    </div>
  );
}
