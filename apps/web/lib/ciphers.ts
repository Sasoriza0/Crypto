import type { Language } from '@shiftcrack/shared';

/**
 * Client-side cipher helpers for the interactive panels. These mirror the
 * server-side algorithms (apps/server/src/services/ciphers/) so the visual
 * decryption previews behave exactly like the real challenges — the final
 * answer is still verified server-side, so this code holds no secrets.
 */

export const EN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
export const UK_ALPHABET = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';

export function getAlphabet(language: Language): string {
  return language === 'uk' ? UK_ALPHABET : EN_ALPHABET;
}

/** Caesar decode: shifts letters back by `shift` (mirrors server decrypt). */
export function caesarDecode(text: string, shift: number, alphabet: string): string {
  const n = alphabet.length;
  const s = ((shift % n) + n) % n;
  return text
    .split('')
    .map((ch) => {
      const idx = alphabet.indexOf(ch);
      return idx === -1 ? ch : alphabet[(idx - s + n) % n]!;
    })
    .join('');
}

export interface LetterFrequency {
  letter: string;
  count: number;
  percent: number;
}

/** Alphabet-letter counts of a text, sorted by count descending. */
export function letterFrequencies(text: string, alphabet: string): LetterFrequency[] {
  const counts = new Map<string, number>();
  for (const ch of text) {
    if (alphabet.includes(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([letter, count]) => ({
      letter,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Apply a cipher→plain substitution map; unmapped letters stay as-is. */
export function applySubstitution(text: string, mapping: Record<string, string>): string {
  return text
    .split('')
    .map((ch) => mapping[ch] ?? ch)
    .join('');
}

/**
 * Vigenère decode by per-position shifts (mirrors the server decrypt):
 * `shifts[i]` is the key-letter shift applied to every letter at position
 * i (modulo the key length). Non-alphabet characters pass through and do
 * not advance the position counter.
 */
export function vigenereDecode(text: string, shifts: number[], alphabet: string): string {
  if (shifts.length === 0) return text;
  const n = alphabet.length;
  let k = 0;
  return text
    .split('')
    .map((ch) => {
      const idx = alphabet.indexOf(ch);
      if (idx === -1) return ch;
      const shift = ((shifts[k % shifts.length]! % n) + n) % n;
      k++;
      return alphabet[(idx - shift + n) % n]!;
    })
    .join('');
}

/** Greatest common divisor of two non-negative integers. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/** Proper divisors of n ≥ 2 (every candidate key length that divides it). */
export function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let i = 2; i <= n; i++) {
    if (n % i === 0) out.push(i);
  }
  return out;
}

export interface RepeatedPattern {
  pattern: string;
  /** Original-text start index of every occurrence (spaces included) — display. */
  textPositions: number[];
  /** Original-text span [start..end] of every occurrence — for highlighting.
   *  The span covers the first..last letter; it may include spaces when the
   *  pattern crosses a word boundary. */
  ranges: { start: number; end: number }[];
  /** Distances between consecutive occurrences, counted in LETTERS of the
   *  solid stream (spaces stripped) — multiples of the Vigenère key length. */
  distances: number[];
}

/**
 * Kasiski examination: find repeated n-grams (length minLen..maxLen) in
 * the ciphertext. THE MATH RUNS ON THE SOLID LETTER STREAM: spaces (and any
 * punctuation) are removed before counting, because the Vigenère key only
 * advances over letters — a distance measured with spaces included would
 * break the period arithmetic and drag the GCD down to 1. Positions are
 * reported in the original text (spaces included) so the analyst can find
 * the matches in the visible ciphertext. N-grams that are substrings of a
 * longer reported pattern are dropped, so the list stays readable.
 */
export function findRepeatedPatterns(
  text: string,
  alphabet: string,
  minLen = 3,
  maxLen = 4,
): RepeatedPattern[] {
  // Solid letter stream: `streamIndex` maps every stream position back to
  // its original text position, so distances are counted in letters only.
  const lower = text.toLowerCase().split('');
  const streamIndex: number[] = [];
  const letters = lower.filter((ch, i) => {
    if (alphabet.includes(ch)) {
      streamIndex.push(i);
      return true;
    }
    return false;
  });
  const stream = letters.join('');
  const occurrences = new Map<string, number[]>();

  for (let len = maxLen; len >= minLen; len--) {
    for (let i = 0; i + len <= stream.length; i++) {
      const gram = stream.slice(i, i + len);
      const list = occurrences.get(gram) ?? [];
      list.push(i);
      occurrences.set(gram, list);
    }
  }

  const repeated = [...occurrences.entries()].filter(([, pos]) => pos.length >= 2);

  // Keep only the most informative n-grams: a shorter gram is dropped when
  // every occurrence is explained by an occurrence of a kept longer one.
  const kept: { gram: string; positions: number[] }[] = [];
  for (const [gram, positions] of repeated.sort((a, b) => b[0].length - a[0].length)) {
    const explained = kept.some(({ gram: longer, positions: longerPositions }) => {
      if (!longer.includes(gram)) return false;
      const offsetSpan = longer.length - gram.length;
      return positions.every((pos) =>
        longerPositions.some((lpos) => pos >= lpos && pos - lpos <= offsetSpan),
      );
    });
    if (!explained) kept.push({ gram, positions });
  }

  return kept
    .map(({ gram, positions }) => ({
      pattern: gram,
      textPositions: positions.map((streamPos) => streamIndex[streamPos]!),
      ranges: positions.map((streamPos) => ({
        start: streamIndex[streamPos]!,
        end: streamIndex[streamPos + gram.length - 1]!,
      })),
      distances: positions.slice(1).map((pos, i) => pos - positions[i]!),
    }))
    .sort((a, b) => b.distances[0]! - a.distances[0]!);
}

/**
 * Noise-immune GCD of Kasiski distances. A naive GCD over ALL distances
 * collapses to 1 as soon as one coincidental repeat lands at a coprime
 * offset — this variant skips any distance that would collapse the GCD,
 * keeping the largest common factor of the "good" subset.
 * Returns 0 when there are no usable distances.
 */
export function kasiskiPeriodGcd(distances: number[]): number {
  const sorted = [...distances].sort((a, b) => b - a);
  let g = 0;
  for (const d of sorted) {
    if (g === 0) {
      g = d;
      continue;
    }
    const candidate = gcd(g, d);
    if (candidate > 1) g = candidate;
  }
  return g;
}

/**
 * Best key-length guess for the Kasiski tool:
 * 1. the noise-immune GCD, reduced to its smallest divisor within 2..max
 *    when it overshoots the slider range;
 * 2. fallback — the candidate in 2..max that divides the most distances
 *    (ties prefer the larger candidate), requiring at least two hits.
 * Returns null when the sample is too thin to judge.
 */
export function suggestKasiskiPeriod(distances: number[], max = 15): number | null {
  const g = kasiskiPeriodGcd(distances);
  if (g > 1) {
    if (g <= max) return g;
    for (let i = 2; i <= max; i++) {
      if (g % i === 0) return i;
    }
    return null;
  }
  let best: number | null = null;
  let bestScore = 0;
  for (let k = 2; k <= max; k++) {
    let score = 0;
    for (const d of distances) {
      if (d % k === 0) score++;
    }
    if (score > bestScore || (score === bestScore && score > 0 && best !== null && k > best)) {
      bestScore = score;
      best = k;
    }
  }
  return bestScore >= 2 ? best : null;
}
