'use client';

import { useState } from 'react';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

/**
 * Phase 2 — AES-ECB block substitution (foundation placeholder). The
 * intercepted record is a block-aligned JSON encrypted in ECB mode: the
 * intel desk already recovered its structure (known plaintext), and the
 * ciphertext blocks are shown as hex chips. The player picks the block
 * position to overwrite and the block to paste over it — replacing the
 * AGENT role block with the HQ role block forges the admin clearance.
 */
export function Phase2Ecb() {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const attemptSwap = useGameStore((s) => s.attemptSwap);
  const chimeraForgedJson = useGameStore((s) => s.chimeraForgedJson);
  const setChimeraPhase = useGameStore((s) => s.setChimeraPhase);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);

  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(1);
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const meta = session?.meta.chimera;
  if (!meta) return null;

  const onApply = async () => {
    if (busy) return;
    setBusy(true);
    setMismatch(false);
    const ok = await attemptSwap(from, to);
    setBusy(false);
    if (!ok) setMismatch(true);
  };

  return (
    <div className="mt-3 border-2 border-ink bg-card p-4 shadow-[5px_5px_0_rgba(66,54,36,0.16)] sm:p-6">
      <div className="border-b border-tan pb-3">
        <MetaLabel>{t('chimera.phase', { current: 2 })}</MetaLabel>
        <h2 className="mt-1 font-serif text-2xl font-bold">{t('chimera.phase2.title')}</h2>
        <p className="mt-1 font-mono text-xs text-fade-dark">{t('chimera.phase2.subtitle')}</p>
      </div>

      <div className="mt-4">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('chimera.phase2.original')}
        </h3>
        <p className="mt-1 whitespace-pre-wrap break-words border border-ink bg-inset p-3 font-mono text-sm">
          {meta.originalJson}
        </p>
      </div>

      <div className="mt-4">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
          {t('chimera.phase2.blocks')}
        </h3>
        <ol className="mt-1 flex flex-wrap gap-2">
          {meta.aesBlocks.map((block, index) => (
            <li
              key={`${block}-${index}`}
              className="border border-tan bg-inset px-2 py-1 font-mono text-[10px] leading-4 text-fade-dark"
            >
              <span className="mr-1 font-bold text-red-700">{index}</span>
              {block}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-tan pt-4">
        <label className="block">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('chimera.phase2.from')}
          </span>
          <input
            type="number"
            min={0}
            max={meta.aesBlocks.length - 1}
            value={from}
            disabled={busy || chimeraForgedJson !== null}
            onChange={(e) => setFrom(Number(e.target.value))}
            className="mt-1 w-24 border border-tan bg-paper px-2 py-1 font-mono text-ink outline-none"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('chimera.phase2.to')}
          </span>
          <input
            type="number"
            min={0}
            max={meta.aesBlocks.length - 1}
            value={to}
            disabled={busy || chimeraForgedJson !== null}
            onChange={(e) => setTo(Number(e.target.value))}
            className="mt-1 w-24 border border-tan bg-paper px-2 py-1 font-mono text-ink outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void onApply()}
          disabled={busy || chimeraForgedJson !== null}
          className="border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('chimera.phase2.apply')}
        </button>
      </div>

      {mismatch && (
        <p className="mt-3 font-mono text-sm text-red-700">
          {t('chimera.phase2.mismatch', { attempts: session?.attempts ?? 1 })}
        </p>
      )}
      {error && (
        <p className="mt-3 font-mono text-sm text-red-700">
          {t(`errors.${errorCode}`) !== `errors.${errorCode}` ? t(`errors.${errorCode}`) : error}
        </p>
      )}

      {chimeraForgedJson !== null && (
        <div className="mt-4 border-t border-tan pt-4">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700">
            {t('chimera.phase2.forged')}
          </h3>
          <p className="mt-1 whitespace-pre-wrap break-words border border-emerald-700 bg-inset p-3 font-mono text-sm">
            {chimeraForgedJson}
          </p>
          <button
            type="button"
            onClick={() => setChimeraPhase(3)}
            className="mt-3 inline-flex items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700"
          >
            {t('chimera.phase2.toPhase3')}
          </button>
        </div>
      )}
    </div>
  );
}
