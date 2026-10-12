import { describe, expect, it } from 'vitest';
import { UK_ALPHABET } from '../src/lib/text.js';
import { buildHint, getMaxHints } from '../src/services/hints.service.js';

/**
 * VIGENERE hint logic: the puzzle is the key — tier 1 reveals its length
 * (the Kasiski goal), tier 2 reveals the first key letter with its shift
 * (the first slider of the key-fitting tool), tier 3 reveals the first
 * plaintext word. VIGENERE keeps at least two tiers even at HARD (the
 * mission is the hardest, so one hint was too brutal).
 */
describe('getMaxHints — VIGENERE budget', () => {
  it('keeps the base budget for regular modules', () => {
    expect(getMaxHints('EASY', 'CAESAR')).toBe(3);
    expect(getMaxHints('MEDIUM', 'TRANSPOSITION')).toBe(2);
    expect(getMaxHints('HARD', 'FREQUENCY')).toBe(1);
  });

  it('grants VIGENERE at least two crypto tiers at every difficulty', () => {
    expect(getMaxHints('HARD', 'VIGENERE')).toBe(2);
    expect(getMaxHints('MEDIUM', 'VIGENERE')).toBe(2);
    expect(getMaxHints('EASY', 'VIGENERE')).toBe(3);
  });
});

describe('buildHint — VIGENERE module', () => {
  const cipherParams = { key: 'ключ' };

  it('tier 1 reveals the key length', () => {
    const hint = buildHint({
      module: 'VIGENERE',
      language: 'uk',
      ciphertext: 'приклад',
      cipherParams,
      tier: 1,
    });
    expect(hint).toBe('Довжина ключа Віженера: 4 літер.');
  });

  it('tier 2 reveals the first key letter with its shift', () => {
    const hint = buildHint({
      module: 'VIGENERE',
      language: 'uk',
      ciphertext: 'приклад',
      cipherParams,
      tier: 2,
    });
    // «к» sits at index 14 of the Ukrainian alphabet
    expect(UK_ALPHABET.indexOf('к')).toBe(14);
    expect(hint).toBe('Перша літера ключа — «к» (зсув 14).');
  });

  it('tier 3 reveals the first plaintext word', () => {
    const hint = buildHint({
      module: 'VIGENERE',
      language: 'uk',
      ciphertext: 'шифротекст',
      cipherParams,
      tier: 3,
    });
    expect(hint).toMatch(/^Перше слово відкритого тексту/);
  });

  it('falls back to the key length when the key is missing (legacy sessions)', () => {
    const hint = buildHint({
      module: 'VIGENERE',
      language: 'uk',
      ciphertext: 'приклад',
      cipherParams: {},
      tier: 2,
    });
    expect(hint).toBe('Довжина ключа Віженера: 0 літер.');
  });
});
