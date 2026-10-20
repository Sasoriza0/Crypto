import type { Language } from '@shiftcrack/shared';
import { getAlphabet, randomIntInRange } from '../../lib/text.js';

/**
 * Vigenère cipher (polyalphabetic shift) over a language-aware alphabet.
 * Every plaintext letter is shifted by the letter of a repeating key word;
 * non-alphabet characters (spaces, punctuation) pass through untouched and
 * do NOT advance the key position — so the ciphertext keeps the word
 * structure of the prepared plaintext.
 *
 * Legacy difficulty tiers are gone (story-fixed missions): the key is
 * always 5–6 letters. Shorter keys collapse the Kasiski period search into
 * a guessing game, longer keys need more statistical material than the
 * mission corpus provides.
 */

export const VIGENERE_KEY_MIN = 5;
export const VIGENERE_KEY_MAX = 6;

/** Random key word made of alphabet letters (fixed balanced 5–6 length). */
export function generateVigenereKey(language: Language): string {
  const alphabet = getAlphabet(language);
  const length = randomIntInRange(VIGENERE_KEY_MIN, VIGENERE_KEY_MAX);
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
