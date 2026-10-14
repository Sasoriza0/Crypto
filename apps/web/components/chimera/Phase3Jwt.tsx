'use client';

import { useMemo, useState } from 'react';
import { AnswerPanel } from '@/components/game/AnswerPanel';
import { MetaLabel } from '@/components/ui/MetaLabel';
import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

/**
 * Phase 3 — JWT lab (kill chain finale). The player brings the forged
 * record from Phase 2 and the signing secret from Phase 1, the local
 * generator builds the standard `header.payload.signature` token (Web
 * Crypto HMAC-SHA256) and submits it. The server verifies the signature
 * against the session secret and requires the payload to equal the target
 * JSON — the accepted payload doubles as the final report.
 */

const JWT_HEADER = '{"alg":"HS256","typ":"JWT"}';

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

/** Forged record + `{"jwt":"<secret>"}` → the target payload to sign. */
export function composeChimeraPayload(forgedJson: string, secret: string): string {
  const base = forgedJson.trim();
  const open = base.endsWith(']') ? base.slice(0, -1) : base;
  return `${open},{"jwt":"${secret.trim()}"}]`;
}

export function Phase3Jwt() {
  const t = useT();
  const chimeraForgedJson = useGameStore((s) => s.chimeraForgedJson);
  const chimeraSecret = useGameStore((s) => s.chimeraSecret);
  const testJwt = useGameStore((s) => s.testJwt);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);

  const [payload, setPayload] = useState(chimeraForgedJson ?? '');
  const [secret, setSecret] = useState(chimeraSecret ?? '');
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');

  const composed = useMemo(() => {
    const p = payload.trim();
    const s = secret.trim();
    if (!p || !s) return null;
    return composeChimeraPayload(p, s);
  }, [payload, secret]);

  /**
   * The PAYLOAD field must hold the forged record (a JSON array) from
   * Phase 2 — anything else is rejected before it ever reaches the
   * signing step, with the reason shown in red under the field.
   */
  const payloadError = useMemo(() => {
    const p = payload.trim();
    if (!p) return null;
    try {
      const parsed = JSON.parse(p) as unknown;
      return Array.isArray(parsed) ? null : t('chimera.phase3.payloadInvalid');
    } catch {
      return t('chimera.phase3.payloadInvalid');
    }
  }, [payload, t]);

  const onFillRewards = () => {
    if (chimeraForgedJson) setPayload(chimeraForgedJson);
    if (!secret.trim() && chimeraSecret) setSecret(chimeraSecret);
  };

  const onGenerate = async () => {
    if (busy || !composed) return;
    setBusy(true);
    setRejected(false);
    try {
      const headerB64 = bytesToBase64url(new TextEncoder().encode(JWT_HEADER));
      const payloadB64 = bytesToBase64url(new TextEncoder().encode(composed));
      const signature = await hmacSha256Hex(secret.trim(), `${headerB64}.${payloadB64}`);
      const token = `${headerB64}.${payloadB64}.${signature}`;
      setGeneratedToken(token);

      const ok = await testJwt(token);
      if (ok) {
        setAccepted(true);
        // The accepted payload IS the target JSON — pipe it straight into
        // the final report.
        setAnswer(composed);
      } else {
        setRejected(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-2 border-ink bg-card p-4 shadow-[5px_5px_0_rgba(66,54,36,0.16)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tan pb-3">
        <div>
          <MetaLabel>{t('chimera.phase', { current: 3 })}</MetaLabel>
          <h2 className="mt-1 font-serif text-2xl font-bold">{t('chimera.phase3.title')}</h2>
          <p className="mt-1 font-mono text-xs text-fade-dark">{t('chimera.phase3.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onFillRewards}
          className="border border-ink px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink transition hover:bg-inset"
        >
          {t('chimera.phase3.fillRewards')}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('chimera.phase3.header')}
          </span>
          <code className="mt-1 block break-all border border-tan bg-inset px-2 py-1.5 font-mono text-xs text-fade-dark">
            {JWT_HEADER}
          </code>
        </label>

        <label className="block">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('chimera.phase3.payload')}
          </span>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder={t('chimera.phase3.payloadPlaceholder')}
            disabled={busy}
            rows={5}
            spellCheck={false}
            className={`mt-1 w-full border bg-paper px-2 py-1.5 font-mono text-xs leading-5 text-ink outline-none disabled:opacity-60 ${
              payloadError ? 'border-red-700' : 'border-tan'
            }`}
          />
          {payloadError && (
            <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-widest text-red-700">
              {payloadError}
            </p>
          )}
        </label>

        <label className="block">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('chimera.phase3.secretField')}
          </span>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t('chimera.phase3.secretPlaceholder')}
            disabled={busy}
            className="mt-1 w-full border border-tan bg-paper px-2 py-1.5 font-mono text-sm tracking-widest text-ink outline-none disabled:opacity-60"
          />
        </label>
      </div>

      {composed && (
        <div className="mt-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('chimera.phase3.composed')}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words border border-dashed border-red-700 bg-inset p-2 font-mono text-xs">
            {composed}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void onGenerate()}
        disabled={busy || !composed || payloadError !== null}
        className="mt-5 inline-flex w-full items-center justify-center gap-3 border-2 border-ink bg-ink px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-paper transition hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? '…' : t('chimera.phase3.generate')} <span aria-hidden>→</span>
      </button>

      {rejected && (
        <p className="mt-3 border border-red-700 bg-paper p-2 font-mono text-sm text-red-700">
          {t('chimera.phase3.rejected')}
        </p>
      )}
      {error && (
        <p className="mt-3 font-mono text-sm text-red-700">
          {t(`errors.${errorCode}`) !== `errors.${errorCode}` ? t(`errors.${errorCode}`) : error}
        </p>
      )}

      {accepted && generatedToken && (
        <div className="mt-4 border border-emerald-700 bg-paper p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700">
            {t('chimera.phase3.accepted')}
          </p>
          <code className="mt-2 block break-all border border-tan bg-inset px-2 py-1.5 font-mono text-xs">
            {generatedToken}
          </code>
          <p className="mt-2 font-serif text-sm text-fade-dark">{t('chimera.phase3.finalHint')}</p>
        </div>
      )}

      <div className="mt-4 border-t border-tan pt-4">
        <p className="mb-2 font-mono text-xs text-fade-dark">{t('chimera.phase3.done')}</p>
        <AnswerPanel answer={answer} onAnswerChange={setAnswer} />
      </div>
    </div>
  );
}
