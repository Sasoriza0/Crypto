'use client';

import { useEffect } from 'react';
import { useT } from '@/lib/i18n';
import { saveScratchpad, useScratchpadStore } from '@/store/scratchpad.store';

/**
 * Global scratchpad (Phase 6): a floating button toggles a slide-out
 * notebook docked to the right edge. On large screens the game content
 * shifts left while it is open, so the notes never cover the workspace.
 * The text autosaves (debounced) to localStorage under the current
 * session id.
 */
export function Scratchpad() {
  const t = useT();
  const open = useScratchpadStore((s) => s.open);
  const note = useScratchpadStore((s) => s.note);
  const sessionId = useScratchpadStore((s) => s.sessionId);
  const toggle = useScratchpadStore((s) => s.toggle);
  const setOpen = useScratchpadStore((s) => s.setOpen);
  const setNote = useScratchpadStore((s) => s.setNote);

  // Debounced autosave; the closure captures the session the note belongs
  // to, so a pending write can never land in another session's key.
  useEffect(() => {
    if (!sessionId) return;
    const timer = setTimeout(() => saveScratchpad(sessionId, note), 300);
    return () => clearTimeout(timer);
  }, [note, sessionId]);

  if (!sessionId) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={toggle}
          className="fixed bottom-4 right-4 z-40 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-lg hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          {t('scratchpad.open')}
        </button>
      )}

      <aside
        aria-label={t('scratchpad.title')}
        className={`fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold">{t('scratchpad.title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('scratchpad.close')}
            className="rounded px-2 py-0.5 text-lg leading-none text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={t('scratchpad.placeholder')}
          className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none"
        />
      </aside>
    </>
  );
}
