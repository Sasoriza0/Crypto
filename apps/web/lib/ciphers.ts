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
