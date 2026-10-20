import { randomIntInRange } from '../../lib/text.js';

/**
 * Caesar (shift) cipher over a custom alphabet (language-aware).
 *
 * Legacy difficulty tiers are gone (story-fixed missions): every challenge
 * uses ONE balanced shift range of 4–15. Shifts of 1–3 were too trivial to
 * rotate by eye and brute-forcing in seconds; the fixed window keeps the
 * wheel genuinely useful while staying clamped to the alphabet size.
 */

export const CAESAR_SHIFT_MIN = 4;
export const CAESAR_SHIFT_MAX = 15;

/** Random shift in the fixed balanced range, clamped to the alphabet. */
export function generateCaesarShift(alphabetLength: number): number {
  const min = Math.min(CAESAR_SHIFT_MIN, Math.max(1, alphabetLength - 1));
  const max = Math.min(CAESAR_SHIFT_MAX, Math.max(1, alphabetLength - 1));
  return randomIntInRange(Math.min(min, max), max);
}

function shiftChar(ch: string, shift: number, alphabet: string): string {
  const n = alphabet.length;
  const s = ((shift % n) + n) % n;
  const idx = alphabet.indexOf(ch);
  if (idx === -1) return ch;
  return alphabet[(idx + s) % n]!;
}

export function caesarEncrypt(text: string, shift: number, alphabet: string): string {
  return text
    .split('')
    .map((ch) => shiftChar(ch, shift, alphabet))
    .join('');
}

export function caesarDecrypt(ciphertext: string, shift: number, alphabet: string): string {
  return caesarEncrypt(ciphertext, -shift, alphabet);
}
