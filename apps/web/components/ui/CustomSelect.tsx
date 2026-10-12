'use client';

import { useEffect, useRef, useState } from 'react';

interface CustomSelectProps {
  /** Currently selected value; '' renders the "clear" placeholder. */
  value: string;
  /** Selectable values (letters of the alphabet). */
  options: string[];
  /** Called with the picked value; '' clears the selection. */
  onChange: (value: string) => void;
  /** Extra classes for the trigger button (e.g. flex-1). */
  className?: string;
}

/** Approximate open-menu height cap (mirrors max-h-52). */
const MENU_MAX_H = 208;

/**
 * Retro custom dropdown (Phase 6 UX): replaces the native <select> — whose
 * OS-drawn white list and blue hover cannot be styled — with a paper-sheet
 * <ul>/<li> menu. The trigger keeps the dossier look (transparent paper,
 * strict tan border, mono type); the opened menu is a fixed vintage-paper
 * card with a stone-500 border, dark mono text and the critical dark
 * hover (`bg-stone-800` + white text). Thin square scrollbar comes from the
 * global retro scrollbar styles in globals.css.
 */
export function CustomSelect({ value, options, onChange, className }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const close = () => setOpen(false);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Open below the trigger; flip above when the viewport has no room.
    const below = window.innerHeight - rect.bottom >= MENU_MAX_H + 8;
    setPosition({
      x: rect.left,
      y: below ? rect.bottom + 4 : Math.max(8, rect.top - MENU_MAX_H - 4),
      width: Math.max(rect.width, 72),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        className={`flex min-w-0 items-center justify-between gap-1 border bg-transparent px-1 py-0.5 font-mono text-sm text-ink outline-none transition ${
          open ? 'border-stone-500 bg-inset' : 'border-tan'
        } ${className ?? ''}`}
      >
        <span className={value ? 'text-ink' : 'text-fade'}>{value || '—'}</span>
        <span aria-hidden className="text-[9px] leading-none text-fade">
          ▾
        </span>
      </button>

      {open && position && (
        <ul
          ref={menuRef}
          role="listbox"
          className="fixed z-50 max-h-52 overflow-y-auto border border-stone-500 bg-[#f5f0e6] py-0.5 shadow-[4px_4px_0_rgba(66,54,36,0.25)]"
          style={{ left: position.x, top: position.y, width: position.width }}
        >
          <li role="option" aria-selected={value === ''}>
            <button
              type="button"
              onClick={() => {
                onChange('');
                close();
              }}
              className="block w-full px-2 py-0.5 text-left font-mono text-sm text-stone-800 transition hover:bg-stone-800 hover:text-white"
            >
              —
            </button>
          </li>
          {options.map((option) => (
            <li key={option} role="option" aria-selected={option === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option);
                  close();
                }}
                className={`block w-full px-2 py-0.5 text-left font-mono text-sm transition ${
                  option === value
                    ? 'bg-stone-200 text-stone-900'
                    : 'text-stone-800 hover:bg-stone-800 hover:text-white'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
