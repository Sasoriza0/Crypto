import type { Difficulty, Language } from '@shiftcrack/shared';
import { getAlphabet, randomIntInRange } from '../../lib/text.js';

/**
 * Vigenère cipher (polyalphabetic shift) over a language-aware alphabet.
 * Every plaintext letter is shifted by the letter of a repeating key word;
 * non-alphabet characters (spaces, punctuation) pass through untouched and
 * do NOT advance the key position — so the ciphertext keeps the word
 * structure of the prepared plaintext.
 *
 * Key length ranges per difficulty (SDD Phase 6 extension):
 * EASY 3–4, MEDIUM 5–6, HARD 7–9 — longer keys hide the Kasiski period.
 */

export interface VigenereKeyRange {
  min: number;
  max: number;
}

export function getVigenereKeyRange(difficulty: Difficulty): VigenereKeyRange {
  switch (difficulty) {
    case 'EASY':
      return { min: 3, max: 4 };
    case 'MEDIUM':
      return { min: 5, max: 6 };
    case 'HARD':
      return { min: 7, max: 9 };
    default:
      throw new Error(`Unknown difficulty: ${String(difficulty)}`);
  }
}

/** Random key word made of alphabet letters (length per difficulty). */
export function generateVigenereKey(language: Language, difficulty: Difficulty): string {
  const alphabet = getAlphabet(language);
  const { min, max } = getVigenereKeyRange(difficulty);
  const length = randomIntInRange(min, max);
  let key = '';
  for (let i = 0; i < length; i++) {
    key += alphabet[randomIntInRange(0, alphabet.length - 1)];
  }
  return key;
}

function vigenereShift(text: string, key: string, alphabet: string, direction: 1 | -1): string {
  const n = alphabet.length;
  if (n === 0 || key.length === 0) return text;
  const keyIndices = key.split('').map((ch) => alphabet.indexOf(ch));
  if (keyIndices.some((idx) => idx === -1)) {
    throw new Error('Vigenere key contains letters outside the alphabet');
  }
  let k = 0;
  return text
    .split('')
    .map((ch) => {
      const idx = alphabet.indexOf(ch);
      if (idx === -1) return ch; // spaces/punctuation pass through, key does not advance
      const shift = keyIndices[k % keyIndices.length]!;
      k++;
      return alphabet[((idx + direction * shift) % n + n) % n]!;
    })
    .join('');
}

export function vigenereEncrypt(text: string, key: string, alphabet: string): string {
  return vigenereShift(text, key, alphabet, 1);
}

export function vigenereDecrypt(ciphertext: string, key: string, alphabet: string): string {
  return vigenereShift(ciphertext, key, alphabet, -1);
}
