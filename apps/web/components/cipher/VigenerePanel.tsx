'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Language } from '@shiftcrack/shared';
import type { RepeatedPattern } from '@/lib/ciphers';
import {
  divisorsOf,
  findRepeatedPatterns,
  getAlphabet,
  kasiskiPeriodGcd,
  suggestKasiskiPeriod,
  vigenereDecode,
} from '@/lib/ciphers';
import { useT } from '@/lib/i18n';
import { AnswerPanel } from '@/components/game/AnswerPanel';

interface VigenerePanelProps {
  ciphertext: string;
  language: Language;
  answer: string;
  onAnswerChange: (value: string) => void;
  onUseCandidate: (candidate: string) => void;
}

type ToolTab = 'kasiski' | 'key';

const MAX_KEY_LENGTH = 15;

/**
 * Vigenère panel (Mission 04): strict two-column board that fits one
 * screen. RIGHT — the intercepted ciphertext (frequency-style spacing:
 * tight letters inside words, wide gaps between words, compact rows) on
 * top, the live decryption report right below it (updates instantly as
 * the sliders move, facing the sliders on the left), and the shared
 * AnswerPanel under the report. LEFT — the analyst tools behind two paper
 * divider tabs: «Метод Касіскі» (scan repeated n-grams, their distances
 * and divisors; the GCD suggests the key length) and «Підбір ключа»
 * (enter the length → one Caesar shift slider per key position).
 */
export function VigenerePanel({
  ciphertext,
  language,
  answer,
  onAnswerChange,
  onUseCandidate,
}: VigenerePanelProps) {
  const t = useT();
  const alphabet = useMemo(() => getAlphabet(language), [language]);

  const [activeTab, setActiveTab] = useState<ToolTab>('kasiski');
  const [patterns, setPatterns] = useState<RepeatedPattern[] | null>(null);
  const [keyLength, setKeyLength] = useState(0);
  const [lengthInput, setLengthInput] = useState('');
  const [shifts, setShifts] = useState<number[]>([]);

  // New session → clean workspace.
  useEffect(() => {
    setActiveTab('kasiski');
    setPatterns(null);
    setKeyLength(0);
    setLengthInput('');
    setShifts([]);
  }, [ciphertext]);

  const words = useMemo(() => {
    const out: { word: string; start: number }[] = [];
    let index = 0;
    for (const part of ciphertext.split(' ')) {
      if (part === '') {
        index += 1;
        continue;
      }
      out.push({ word: part, start: index });
      index += part.length + 1;
    }
    return out;
  }, [ciphertext]);

  const candidate = useMemo(
    () => vigenereDecode(ciphertext, shifts, alphabet),
    [ciphertext, shifts, alphabet],
  );

  const scan = () => setPatterns(findRepeatedPatterns(ciphertext, alphabet, 3, 4));

  const allDistances = useMemo(() => patterns?.flatMap((pattern) => pattern.distances) ?? [], [patterns]);
  const periodGcd = useMemo(() => kasiskiPeriodGcd(allDistances), [allDistances]);
  const suggested = useMemo(() => suggestKasiskiPeriod(allDistances, MAX_KEY_LENGTH), [allDistances]);

  // Original-text letter indexes covered by a found pattern (for the rose
  // highlighting in the ciphertext block). Ranges may include spaces when a
  // pattern crosses a word boundary — harmless, spaces render as gaps.
  const highlightedIndexes = useMemo(() => {
    const set = new Set<number>();
    for (const pattern of patterns ?? []) {
      for (const range of pattern.ranges) {
        for (let i = range.start; i <= range.end; i++) set.add(i);
      }
    }
    return set;
  }, [patterns]);

  const applyLength = (n: number) => {
    const capped = Math.max(0, Math.min(MAX_KEY_LENGTH, Math.floor(n)));
    setKeyLength(capped);
    setLengthInput(capped > 0 ? String(capped) : '');
    setShifts((prev) => Array.from({ length: capped }, (_, i) => prev[i] ?? 0));
  };

  const onLengthInput = (raw: string) => {
    setLengthInput(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setKeyLength(0);
      setShifts([]);
      return;
    }
    const capped = Math.min(parsed, MAX_KEY_LENGTH);
    setKeyLength(capped);
    setShifts((prev) => Array.from({ length: capped }, (_, i) => prev[i] ?? 0));
  };

  const onShiftChange = (index: number, value: number) => {
    setShifts((prev) => prev.map((shift, i) => (i === index ? value : shift)));
  };

  const tabBase = 'relative -mb-px border border-b-0 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition';
  const tabClass = (tab: ToolTab) =>
    `${tabBase} ${
      activeTab === tab ? 'border-stone-400 bg-card text-red-700' : 'border-transparent text-fade hover:text-ink'
    }`;

  return (
    <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
      {/* LEFT — analyst tools (paper divider tabs) */}
      <div className="order-2 min-w-0 lg:order-1">
        <div className="flex border-b border-stone-400">
          <button type="button" onClick={() => setActiveTab('kasiski')} className={tabClass('kasiski')}>
            {t('vigenere.tabs.kasiski')}
          </button>
          <button type="button" onClick={() => setActiveTab('key')} className={tabClass('key')}>
            {t('vigenere.tabs.key')}
          </button>
        </div>

        <div className="border-x border-b border-stone-400 bg-card p-3">
          {activeTab === 'kasiski' && (
            <div>
              <button
                type="button"
                onClick={scan}
                className="border border-ink px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
              >
                {t('vigenere.kasiski.scan')}
              </button>

              {patterns === null ? (
                <p className="mt-3 font-mono text-xs leading-5 text-fade">{t('vigenere.kasiski.hint')}</p>
              ) : patterns.length === 0 ? (
                <p className="mt-3 font-mono text-xs text-fade">{t('vigenere.kasiski.empty')}</p>
              ) : (
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {patterns.slice(0, 10).map((pattern) => {
                    const divisors = [...new Set(pattern.distances.flatMap((d) => divisorsOf(d)))].slice(0, 8);
                    return (
                      <div key={pattern.pattern} className="border border-tan bg-paper px-2 py-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="font-mono text-sm font-bold tracking-[0.3em] text-red-700">
                            {pattern.pattern}
                          </span>
                          <span className="font-mono text-xs text-fade">
                            {t('vigenere.kasiski.positions')}: {pattern.textPositions.join(', ')}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-xs text-fade">
                          <span>
                            {t('vigenere.kasiski.distances')}: {pattern.distances.join(', ')}
                          </span>
                          <span>
                            {t('vigenere.kasiski.divisors')}: {divisors.join(', ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="border border-red-700 bg-card px-2 py-1.5">
                    <span className="font-mono text-xs">
                      <span className="font-bold uppercase tracking-widest text-red-700">
                        {t('vigenere.kasiski.gcd')}:
                      </span>{' '}
                      <span className="text-ink">{periodGcd > 1 ? periodGcd : '—'}</span>
                    </span>
                    {suggested !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          applyLength(suggested);
                          setActiveTab('key');
                        }}
                        className="ml-3 border border-ink px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
                      >
                        {t('vigenere.kasiski.useLength', { n: suggested })}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'key' && (
            <div>
              <label
                htmlFor="vigenere-key-length"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade"
              >
                {t('vigenere.key.length')}
              </label>
              <div className="mt-1">
                <input
                  id="vigenere-key-length"
                  type="number"
                  min={1}
                  max={MAX_KEY_LENGTH}
                  value={lengthInput}
                  onChange={(e) => onLengthInput(e.target.value)}
                  onBlur={() => setLengthInput(keyLength > 0 ? String(keyLength) : '')}
                  placeholder={t('vigenere.key.lengthPlaceholder')}
                  className="w-24 border border-tan bg-card px-2 py-1 font-mono text-sm text-ink outline-none placeholder:text-fade"
                />
              </div>

              {keyLength > 0 ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: keyLength }, (_, index) => (
                    <div key={index} className="border border-tan bg-paper px-2 py-1.5">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-fade">
                        <span>{t('vigenere.key.letter', { n: index + 1 })}</span>
                        <span className="text-base font-bold tracking-normal text-ink">
                          {alphabet[shifts[index] ?? 0]}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={alphabet.length - 1}
                          value={shifts[index] ?? 0}
                          onChange={(e) => onShiftChange(index, Number(e.target.value))}
                          aria-label={t('vigenere.key.letter', { n: index + 1 })}
                          className="w-full cursor-pointer accent-red-700"
                        />
                        <span className="w-7 shrink-0 text-right font-mono text-xs text-ink">
                          {shifts[index] ?? 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-mono text-xs text-fade">{t('vigenere.key.none')}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — the intercepted message, live decryption + answer report */}
      <div className="order-1 flex flex-col gap-3 lg:order-2">
        <div>
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('game.ciphertext')}
          </h2>
          <div className="mt-1 border border-ink bg-inset p-3 font-mono text-lg">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {words.map(({ word, start }, wordIndex) => (
                <span key={wordIndex} className="flex gap-1">
                  {word.split('').map((ch, letterIndex) => (
                    <span
                      key={letterIndex}
                      className={
                        highlightedIndexes.has(start + letterIndex)
                          ? 'bg-rose-200/60 dark:bg-rose-900/40'
                          : ''
                      }
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
          {highlightedIndexes.size > 0 && (
            <p className="mt-1 font-mono text-xs text-fade">{t('vigenere.kasiski.highlighted')}</p>
          )}
        </div>

        {/* Decryption report — updates live as the shift sliders move */}
        <div>
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade">
            {t('game.candidate')}
          </h2>
          {keyLength > 0 ? (
            <>
              <p className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words border border-dashed border-red-700 bg-card p-3 font-mono text-base leading-relaxed sm:text-lg">
                {candidate}
              </p>
              <button
                type="button"
                onClick={() => onUseCandidate(candidate)}
                className="mt-1 border border-ink px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
              >
                {t('game.useCandidate')}
              </button>
            </>
          ) : (
            <p className="mt-1 border border-dashed border-red-700 bg-card p-3 font-mono text-sm text-fade">
              {t('vigenere.decryption.empty')}
            </p>
          )}
        </div>

        <AnswerPanel answer={answer} onAnswerChange={onAnswerChange} />
      </div>
    </div>
  );
}
