'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChimeraPacket } from '@shiftcrack/shared';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import { useGameStore, type MitMVerifyResult } from '@/store/game.store';

/**
 * Phase 1 — MitM: a retro network interceptor (Burp-Suite-style terminal).
 * Three steps: (1) SNIFFING — animated traffic logs roll while the HQ and
 * the AGENT exchange their public keys, and the operator hits
 * [ ЗАТРИМАТИ ТРАФІК ] to freeze the channel; (2) INJECTION — the two
 * intercepted JSON packets appear together with the player's proxy key,
 * and the player forges both textareas: `pub_key` → proxy key, `src`/`dst`
 * untouched; (3) CAPTURE — [ ВІДПРАВИТИ ПІДРОБЛЕНІ ПАКЕТИ ] verifies the
 * forged packets (local JSON check + server) and, on success, the channel
 * routes through the proxy: the decrypted packet reveals the JWT secret
 * and Phase 2 unlocks.
 */

const SNIFF_LINES_MAX = 40;
const SNIFF_TICK_MS = 170;

const SNIFF_TEMPLATES: ReadonlyArray<(hex: () => string) => string> = [
  (h) => `TCP 10.7.0.1:8443 → 10.7.0.4:443 [PSH,ACK] Len=${64 + (h.length % 3)}`,
  (h) => `TLSv1.3 ClientHello · cipher=0x1301 · random=${h()}`,
  (h) => `ARP who-has 10.7.0.2 tell 10.7.0.1 · ${h()}`,
  () => `TCP 10.7.0.4:443 → 10.7.0.1:8443 [ACK] Len=0`,
  (h) => `TLSv1.3 ServerHello · session=${h()}`,
  (h) => `UDP 10.7.0.4:5353 → 224.0.0.251:5353 mDNS PTR · ${h()}`,
  (h) => `TCP 10.7.0.4:443 → 10.7.0.1:8443 [PSH,ACK] Len=${128 + (h.length % 5)}`,
  (h) => `TLSv1.3 Certificate · CN=chimera.hq.internal · ${h()}`,
  () => `ICMP echo request 10.7.0.1 → 10.7.0.4 ttl=64`,
  (h) => `DHKE pubkey=0x${h().slice(0, 12)} · g=2 · p=8192bit`,
];

function randomHex(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  }
  return out;
}

function nextSniffLine(): string {
  const hex = () => randomHex(4 + Math.floor(Math.random() * 5) * 2);
  const template = SNIFF_TEMPLATES[Math.floor(Math.random() * SNIFF_TEMPLATES.length)]!;
  const stamp = new Date().toTimeString().slice(0, 8);
  return `[${stamp}] ${template(hex)}`;
}

/** Local structural feedback for one forged-packet textarea. */
interface PacketFeedback {
  parsed: boolean;
  routeOk: boolean;
  keyOk: boolean;
}

function inspectPacket(text: string, original: ChimeraPacket, proxyKey: string | null): PacketFeedback {
  let parsed: ChimeraPacket | null = null;
  try {
    const value = JSON.parse(text) as Partial<ChimeraPacket>;
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof value.src === 'string' &&
      typeof value.dst === 'string' &&
      typeof value.pub_key === 'string'
    ) {
      parsed = value as ChimeraPacket;
    }
  } catch {
    // invalid JSON
  }
  if (!parsed) return { parsed: false, routeOk: false, keyOk: false };
  return {
    parsed: true,
    routeOk: parsed.src === original.src && parsed.dst === original.dst,
    keyOk: proxyKey !== null && parsed.pub_key === proxyKey,
  };
}

function packetJson(packet: ChimeraPacket): string {
  return JSON.stringify(packet, null, 2);
}

const TERMINAL_LINE = 'font-mono text-[11px] leading-5';

export function Phase1MitM() {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const interceptedPackets = useGameStore((s) => s.interceptedPackets);
  const proxyKey = useGameStore((s) => s.proxyKey);
  const isMitMSuccessful = useGameStore((s) => s.isMitMSuccessful);
  const verifyMitMPackets = useGameStore((s) => s.verifyMitMPackets);
  const setChimeraPhase = useGameStore((s) => s.setChimeraPhase);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);

  const [stage, setStage] = useState<'sniff' | 'inject'>(isMitMSuccessful ? 'inject' : 'sniff');
  const [sniffing, setSniffing] = useState(!isMitMSuccessful);
  const [lines, setLines] = useState<string[]>([]);
  const [hqText, setHqText] = useState('');
  const [agentText, setAgentText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MitMVerifyResult | null>(null);

  /** End anchor of the terminal log — keeps the latest traffic in view. */
  const logEndRef = useRef<HTMLDivElement>(null);

  const meta = session?.meta.chimera;
  if (!meta || !interceptedPackets) return null;

  const { hqPacket, agentPacket } = interceptedPackets;

  useEffect(() => {
    if (!sniffing) return;
    const id = window.setInterval(() => {
      setLines((prev) => [...prev.slice(-(SNIFF_LINES_MAX - 1)), nextSniffLine()]);
    }, SNIFF_TICK_MS);
    return () => window.clearInterval(id);
  }, [sniffing]);

  // Auto-scroll: every new log line scrolls the terminal window to the
  // bottom anchor, so the freshest traffic is always visible.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const onHold = () => {
    setSniffing(false);
    setStage('inject');
    setHqText(packetJson(hqPacket));
    setAgentText(packetJson(agentPacket));
  };

  const hqFeedback = useMemo(
    () => inspectPacket(hqText, hqPacket, proxyKey),
    [hqText, hqPacket, proxyKey],
  );
  const agentFeedback = useMemo(
    () => inspectPacket(agentText, agentPacket, proxyKey),
    [agentText, agentPacket, proxyKey],
  );

  const onSend = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const outcome = await verifyMitMPackets(hqText, agentText);
    setBusy(false);
    setResult(outcome);
  };

  const resultMessage = result && !result.ok ? t(`chimera.phase1.fail.${result.reason}`, { attempts: session?.attempts ?? 1 }) : null;

  return (
    <div className="mt-3 border-2 border-ink bg-card p-4 shadow-[5px_5px_0_rgba(66,54,36,0.16)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tan pb-3">
        <div>
          <MetaLabel>{t('chimera.phase', { current: 1 })}</MetaLabel>
          <h2 className="mt-1 font-serif text-2xl font-bold">{t('chimera.phase1.title')}</h2>
          <p className="mt-1 font-mono text-xs text-fade-dark">{t('chimera.phase1.subtitle')}</p>
        </div>
      </div>

      {/* Retro terminal window */}
      <div className="mt-4 border-2 border-stone-800 bg-paper shadow-[5px_5px_0_rgba(28,25,23,0.35)]">
        <div className="flex items-center justify-between border-b-2 border-stone-800 bg-stone-200 px-3 py-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-stone-800">
            {t('chimera.phase1.terminal')}
          </span>
          <span aria-hidden className="flex gap-1">
            <span className="inline-block h-2 w-2 border border-stone-800" />
            <span className="inline-block h-2 w-2 border border-stone-800" />
            <span className="inline-block h-2 w-2 border border-stone-800" />
          </span>
        </div>

        {stage === 'sniff' && (
          <div className="p-3">
            <p className={`${TERMINAL_LINE} font-bold uppercase tracking-[0.2em] text-red-700`}>
              {t('chimera.phase1.sniff.title')}
            </p>
            <div className="mt-2 h-44 w-full overflow-x-auto overflow-y-auto border border-stone-800 bg-paper p-2">
              {lines.map((line, index) => (
                <p
                  key={`${index}-${line}`}
                  className={`${TERMINAL_LINE} whitespace-pre-wrap break-all text-stone-700`}
                >
                  <span className="text-stone-400">▸ </span>
                  {line}
                </p>
              ))}
              <p className={`${TERMINAL_LINE} text-red-700`}>
                <span className="mr-1 animate-pulse">▮</span>
                {t('chimera.phase1.sniff.hint')}
              </p>
              <div ref={logEndRef} />
            </div>
            <button
              type="button"
              onClick={onHold}
              disabled={sniffing === false}
              className="mt-3 inline-flex items-center justify-center gap-3 border-2 border-stone-800 bg-stone-800 px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('chimera.phase1.sniff.hold')} <span aria-hidden>⏸</span>
            </button>
          </div>
        )}

        {stage === 'inject' && !isMitMSuccessful && (
          <div className="p-3">
            <p className={`${TERMINAL_LINE} font-bold uppercase tracking-[0.2em] text-red-700`}>
              {t('chimera.phase1.inject.title')}
            </p>
            <p className={`${TERMINAL_LINE} text-stone-700`}>{t('chimera.phase1.inject.hint')}</p>
            <div className="mt-3 border border-dashed border-red-700 bg-inset p-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-red-700">
                {t('chimera.phase1.proxyKey')}
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="border border-tan bg-paper px-2 py-1 font-mono text-lg font-bold tracking-widest">
                  {proxyKey ?? '—'}
                </code>
                <ProxyKeyCopy />
              </div>
              <p className="mt-1 font-serif text-sm text-fade-dark">{t('chimera.phase1.proxyKeyHint')}</p>
            </div>

            <div className="mt-4 flex w-full flex-col gap-4 md:flex-row">
              <PacketForge
                label={t('chimera.phase1.packetFrom', { party: t('chimera.phase1.party.hq') })}
                original={packetJson(hqPacket)}
                value={hqText}
                feedback={hqFeedback}
                busy={busy}
                onChange={setHqText}
                t={t}
              />
              <PacketForge
                label={t('chimera.phase1.packetFrom', { party: t('chimera.phase1.party.agent') })}
                original={packetJson(agentPacket)}
                value={agentText}
                feedback={agentFeedback}
                busy={busy}
                onChange={setAgentText}
                t={t}
              />
            </div>

            <button
              type="button"
              onClick={() => void onSend()}
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-3 border-2 border-stone-800 bg-stone-800 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '…' : t('chimera.phase1.send')} <span aria-hidden>⇢</span>
            </button>

            {resultMessage && (
              <p className="mt-3 border border-red-700 bg-paper p-2 font-mono text-sm text-red-700">
                {resultMessage}
              </p>
            )}
            {error && (
              <p className="mt-3 font-mono text-sm text-red-700">
                {t(`errors.${errorCode}`) !== `errors.${errorCode}` ? t(`errors.${errorCode}`) : error}
              </p>
            )}
          </div>
        )}

        {isMitMSuccessful && (
          <div className="p-3">
            <p className={`${TERMINAL_LINE} font-bold uppercase tracking-[0.2em] text-emerald-700`}>
              {t('chimera.phase1.terminalSeized')}
            </p>
            <div className="mt-2 w-full overflow-x-auto border border-stone-800 bg-inset p-2">
              <p className={`${TERMINAL_LINE} break-all text-stone-700`}>
                <span className="text-stone-400">▸ </span>
                {t('chimera.phase1.terminalRoute', { key: proxyKey ?? '—' })}
              </p>
              <p className={`${TERMINAL_LINE} break-all text-stone-700`}>
                <span className="text-stone-400">▸ </span>
                {t('chimera.phase1.terminalDecrypted')}
              </p>
            </div>
          </div>
        )}
      </div>

      {isMitMSuccessful && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-tan pt-4">
            <span className="rotate-[-2deg] border-2 border-red-700 px-3 py-1 font-mono text-xs font-bold tracking-[0.25em] text-red-700">
              {t('chimera.phase1.captured')}
            </span>
            <button
              type="button"
              onClick={() => setChimeraPhase(2)}
              className="inline-flex items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700"
            >
              {t('chimera.phase1.toPhase2')}
            </button>
          </div>
          <DecryptedPacket />
        </>
      )}
    </div>
  );
}

interface PacketForgeProps {
  label: string;
  original: string;
  value: string;
  feedback: PacketFeedback;
  busy: boolean;
  onChange: (value: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function PacketForge({ label, original, value, feedback, busy, onChange, t }: PacketForgeProps) {
  const dirty = value.trim().length > 0;
  const invalid = dirty && !feedback.parsed;
  const broken = feedback.parsed && (!feedback.routeOk || !feedback.keyOk);
  const status = !dirty
    ? null
    : invalid
      ? { text: t('chimera.phase1.jsonInvalid'), className: 'text-red-700' }
      : broken
        ? feedback.routeOk
          ? { text: t('chimera.phase1.keyNotReplaced'), className: 'text-amber-700' }
          : { text: t('chimera.phase1.routeBroken'), className: 'text-red-700' }
        : { text: t('chimera.phase1.keyReplaced'), className: 'text-emerald-700' };

  const borderClass = invalid ? 'border-red-700' : broken ? 'border-amber-700' : 'border-stone-800';

  return (
    <div className="w-full">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-stone-800">{label}</p>
      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words border border-stone-800 bg-inset p-2 font-mono text-[11px] leading-4 text-fade-dark">
        {original}
      </pre>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        rows={5}
        spellCheck={false}
        className={`mt-2 w-full border ${borderClass} bg-paper px-2 py-1.5 font-mono text-[11px] leading-5 text-ink outline-none disabled:opacity-60`}
      />
      {status && (
        <p className={`mt-1 font-mono text-[11px] font-bold uppercase tracking-widest ${status.className}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}

/** Phase 1 material: the player's proxy key with a copy button. */
function ProxyKeyCopy() {
  const t = useT();
  const proxyKey = useGameStore((s) => s.proxyKey);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!proxyKey) return;
    try {
      await navigator.clipboard.writeText(proxyKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the value stays selectable by hand
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      disabled={!proxyKey}
      className="border border-stone-800 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-stone-800 transition hover:bg-inset disabled:cursor-not-allowed disabled:opacity-50"
    >
      {copied ? t('chimera.phase1.copied') : t('chimera.phase1.copy')}
    </button>
  );
}

/**
 * Phase 1 reward: once the injection seizes the channel, the intercepted
 * packet decrypts into the JWT signing secret the player must carry into
 * the phase-3 generator. Retro telex strip with a copy button.
 */
function DecryptedPacket() {
  const t = useT();
  const chimeraSecret = useGameStore((s) => s.chimeraSecret);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!chimeraSecret) return;
    try {
      await navigator.clipboard.writeText(chimeraSecret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the value stays selectable by hand
    }
  };

  return (
    <div className="mt-4 border border-stone-800 bg-paper p-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-red-700">
        {t('chimera.phase1.packet')}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-fade">
          {t('chimera.phase1.packetSecret')}
        </span>
        <code className="break-all border border-tan bg-inset px-2 py-1 font-mono text-lg font-bold tracking-widest">
          {chimeraSecret ?? '—'}
        </code>
        <button
          type="button"
          onClick={() => void onCopy()}
          disabled={!chimeraSecret}
          className="border border-stone-800 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-stone-800 transition hover:bg-inset disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? t('chimera.phase1.copied') : t('chimera.phase1.copy')}
        </button>
      </div>
      <p className="mt-2 font-serif text-sm text-fade-dark">{t('chimera.phase1.packetHint')}</p>
    </div>
  );
}
