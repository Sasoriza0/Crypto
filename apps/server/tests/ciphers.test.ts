import { describe, expect, it } from 'vitest';
import { EN_ALPHABET, UK_ALPHABET } from '../src/lib/text.js';
import { caesarDecrypt, caesarEncrypt, getCaesarShiftRange } from '../src/services/ciphers/caesar.js';
import { generateSubstitution, substitute } from '../src/services/ciphers/substitution.js';
import { generateTranspositionKey, transpositionDecrypt, transpositionEncrypt } from '../src/services/ciphers/transposition.js';

describe('caesar cipher', () => {
  it('round-trips on the English alphabet for every shift', () => {
    const text = 'attackatdawn';
    for (let shift = 1; shift < EN_ALPHABET.length; shift++) {
      expect(caesarDecrypt(caesarEncrypt(text, shift, EN_ALPHABET), shift, EN_ALPHABET)).toBe(text);
    }
  });

  it('round-trips on the Ukrainian alphabet', () => {
    const text = 'славаукраїні';
    const encrypted = caesarEncrypt(text, 7, UK_ALPHABET);
    expect(caesarDecrypt(encrypted, 7, UK_ALPHABET)).toBe(text);
  });

  it('keeps non-alphabet characters untouched', () => {
    expect(caesarEncrypt('a-b c', 1, EN_ALPHABET)).toBe('b-c d');
  });

  it('uses the difficulty ranges defined in SDD §4', () => {
    expect(getCaesarShiftRange('EASY', 33)).toEqual({ min: 1, max: 3 });
    expect(getCaesarShiftRange('MEDIUM', 33)).toEqual({ min: 4, max: 15 });
    expect(getCaesarShiftRange('HARD', 33)).toEqual({ min: 1, max: 32 });
  });
});

describe('transposition cipher', () => {
  it('round-trips when the text length is a multiple of the key length', () => {
    const text = 'abcdefghijkl';
    for (const key of [
      [0, 1, 2, 3],
      [2, 0, 3, 1],
      [4, 1, 3, 0, 2],
    ]) {
      expect(transpositionDecrypt(transpositionEncrypt(text, key), key)).toBe(text);
    }
  });

  it('round-trips when the last row is incomplete', () => {
    const text = 'thequickbrownfox';
    for (const key of [
      [2, 0, 4, 3, 1],
      [1, 3, 0, 2],
      [5, 2, 0, 3, 1, 4],
    ]) {
      expect(transpositionDecrypt(transpositionEncrypt(text, key), key)).toBe(text);
    }
  });

  it('actually permutes the text', () => {
    const key = [1, 0, 2];
    expect(transpositionEncrypt('abcdef', key)).not.toBe('abcdef');
  });

  it('generates keys within the SDD length ranges', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTranspositionKey('EASY').length).toBeGreaterThanOrEqual(4);
      expect(generateTranspositionKey('EASY').length).toBeLessThanOrEqual(5);
      expect(generateTranspositionKey('MEDIUM').length).toBeGreaterThanOrEqual(6);
      expect(generateTranspositionKey('MEDIUM').length).toBeLessThanOrEqual(7);
      expect(generateTranspositionKey('HARD').length).toBeGreaterThanOrEqual(8);
      expect(generateTranspositionKey('HARD').length).toBeLessThanOrEqual(9);
    }
  });
});

describe('substitution cipher', () => {
  it('round-trips encrypt then decrypt', () => {
    const cipherAlphabet = generateSubstitution(EN_ALPHABET);
    const text = 'frequencyanalysis';
    const encrypted = substitute(text, EN_ALPHABET, cipherAlphabet, 'encrypt');
    expect(substitute(encrypted, EN_ALPHABET, cipherAlphabet, 'decrypt')).toBe(text);
  });

  it('produces a permutation of the alphabet', () => {
    const cipherAlphabet = generateSubstitution(UK_ALPHABET);
    expect([...cipherAlphabet].sort().join('')).toBe([...UK_ALPHABET].sort().join(''));
  });
});
