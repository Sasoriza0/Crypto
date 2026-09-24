import type { Difficulty } from '@shiftcrack/shared';
import { randomIntInRange } from '../../lib/text.js';

/**
 * Caesar (shift) cipher over a custom alphabet (language-aware).
 * Difficulty ranges per SDD §4: EASY 1–3, MEDIUM 4–15, HARD 1..len-1.
 */

export interface ShiftRange {
  min: number;
  max: number;
}

export function getCaesarShiftRange(difficulty: Difficulty, alphabetLength: number): ShiftRange {
  switch (difficulty) {
    case 'EASY':
      return { min: 1, max: Math.min(3, alphabetLength - 1) };
    case 'MEDIUM':
      return { min: 4, max: Math.min(15, alphabetLength - 1) };
    case 'HARD':
      return { min: 1, max: alphabetLength - 1 };
    default:
      throw new Error(`Unknown difficulty: ${String(difficulty)}`);
  }
}

export function generateCaesarShift(difficulty: Difficulty, alphabetLength: number): number {
  const { min, max } = getCaesarShiftRange(difficulty, alphabetLength);
  return randomIntInRange(min, max);
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
