import { describe, expect, it } from 'vitest';
import { UK_ALPHABET } from '../src/lib/text.js';
import { buildHint, getMaxHints, MAX_CRYPTO_HINTS } from '../src/services/hints.service.js';

/**
 * VIGENERE hint logic: the puzzle is the key — tier 1 reveals its length
 * (the Kasiski goal), tier 2 reveals the first key letter with its shift
 * (the first slider of the key-fitting tool). Legacy difficulty budgets
 * are gone: every module gets the same fixed two tiers.
 */
describe('getMaxHints — fixed balanced budget', () => {
  it('grants two crypto tiers to every module', () => {
    for (const module of ['CAESAR', 'TRANSPOSITION', 'FREQUENCY', 'VIGENERE', 'CHIMERA'] as const) {
      expect(getMaxHints(module)).toBe(MAX_CRYPTO_HINTS);
    }
    expect(MAX_CRYPTO_HINTS).toBe(2);
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
