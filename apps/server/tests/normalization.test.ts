import { describe, expect, it } from 'vitest';
import { EN_ALPHABET, UK_ALPHABET, normalizeText, sha256Hex, timingSafeEqualHex } from '../src/lib/text.js';

describe('normalizeText', () => {
  it('lowercases and strips punctuation, digits and whitespace', () => {
    expect(normalizeText('  Hello, World! 42 ', EN_ALPHABET)).toBe('helloworld');
  });

  it('keeps Ukrainian-specific letters', () => {
    expect(normalizeText('Слава Україні!', UK_ALPHABET)).toBe('славаукраїні');
  });

  it('drops characters that do not belong to the alphabet', () => {
    // Latin letters are not part of the Ukrainian alphabet
    expect(normalizeText('тестtest', UK_ALPHABET)).toBe('тест');
    expect(normalizeText('тестtest', EN_ALPHABET)).toBe('test');
  });

  it('is deterministic', () => {
    const a = normalizeText('The QUICK Brown Fox!', EN_ALPHABET);
    const b = normalizeText('the quick brown fox', EN_ALPHABET);
    expect(a).toBe(b);
  });
});

describe('sha256Hex / timingSafeEqualHex', () => {
  it('hashes deterministically', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });

  it('compares equal-length digests safely', () => {
    const a = sha256Hex('secret');
    const b = sha256Hex('secret');
    const c = sha256Hex('secret!');
    expect(timingSafeEqualHex(a, b)).toBe(true);
    expect(timingSafeEqualHex(a, c)).toBe(false);
  });

  it('returns false on length mismatch instead of throwing', () => {
    expect(timingSafeEqualHex('ab', 'abcdef')).toBe(false);
  });
});
