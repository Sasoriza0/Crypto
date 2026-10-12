'use client';

import { useEffect } from 'react';
import { useT } from '@/lib/i18n';
import { saveScratchpad, useScratchpadStore } from '@/store/scratchpad.store';

/**
 * Global scratchpad (Phase 6): a floating button toggles a slide-out
 * notebook docked to the right edge. The drawer is a pure overlay —
 * `fixed` over the dossier, so opening it never reflows or squeezes the
 * game board. The text autosaves (debounced) to localStorage under the
 * current session id.
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
          className="fixed bottom-4 right-4 z-40 border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper shadow-[4px_4px_0_rgba(66,54,36,0.16)] transition hover:border-red-700 hover:bg-red-700"
        >
          {t('scratchpad.open')}
        </button>
      )}

      <aside
        aria-label={t('scratchpad.title')}
        className={`fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-l border-tan bg-paper text-ink shadow-[-16px_0_40px_rgba(20,15,5,0.35)] transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-tan px-4 py-3">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('scratchpad.title')}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('scratchpad.close')}
            className="border border-ink px-2 py-0.5 font-mono text-xs leading-none text-ink transition hover:bg-inset"
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
          className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 text-ink outline-none placeholder:text-fade"
        />
      </aside>
    </>
  );
}
