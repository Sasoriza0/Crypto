import { describe, expect, it } from 'vitest';
import { getAlphabet } from '../src/lib/text.js';
import { buildHint } from '../src/services/hints.service.js';
import { listModules } from '../src/services/modules.service.js';

/**
 * FREQUENCY hint logic: every tier reveals one concrete cipher→plain
 * substitution, preferring letters the player maps wrong (SDD Phase 5).
 * Test fixture: the cipher alphabet is the reversed plain alphabet, so
 * cipher «я» → plain «а», cipher «а» → plain «я», etc.
 */

const alphabet = getAlphabet('uk');
const reversed = alphabet.split('').reverse().join('');

function frequencyHint(ciphertext: string, tier: number, substitution?: Record<string, string>): string {
  return buildHint({
    module: 'FREQUENCY',
    language: 'uk',
    ciphertext,
    cipherParams: { alphabet: reversed },
    tier,
    substitution,
  });
}

describe('buildHint — FREQUENCY module', () => {
  it('tier 1 without guesses reveals the most frequent ciphertext letter', () => {
    const hint = frequencyHint('яяяа', 1);
    expect(hint).toBe('Літера «я» у шифротексті відповідає літері «а».');
  });

  it('skips letters the player already mapped correctly', () => {
    // «я»→«а» is correct, so the hint moves to the next candidate «а»→«я»
    const hint = frequencyHint('яяяа', 1, { я: 'а' });
    expect(hint).toBe('Літера «а» у шифротексті відповідає літері «я».');
  });

  it('prioritizes letters the player maps incorrectly', () => {
    // «я» is mapped wrong («б»), so it wins over the unmapped «а»
    const hint = frequencyHint('яяяа', 1, { я: 'б' });
    expect(hint).toBe('Літера «я» у шифротексті відповідає літері «а».');
  });

  it('advances through candidates on higher tiers without repeating', () => {
    const tier1 = frequencyHint('яяяа', 1);
    const tier2 = frequencyHint('яяяа', 2);
    expect(tier2).toBe('Літера «а» у шифротексті відповідає літері «я».');
    expect(tier2).not.toBe(tier1);
  });

  it('wraps tier index around the candidate list', () => {
    const hint = frequencyHint('яяяа', 3);
    expect(hint).toBe('Літера «я» у шифротексті відповідає літері «а».');
  });

  it('ignores guesses with letters outside the alphabet', () => {
    const hint = frequencyHint('яяяа', 1, { z: 'а', я: 'x' });
    expect(hint).toBe('Літера «я» у шифротексті відповідає літері «а».');
  });

  it('produces an English message for en sessions', () => {
    const hint = buildHint({
      module: 'FREQUENCY',
      language: 'en',
      ciphertext: 'eea',
      cipherParams: { alphabet: 'zyxwvutsrqponmlkjihgfedcba' },
      tier: 1,
    });
    expect(hint).toBe('The letter "e" in the ciphertext corresponds to "v".');
  });
});

describe('buildHint — other modules stay unchanged', () => {
  it('CAESAR tier 1 still reports the most frequent letter', () => {
    const hint = buildHint({
      module: 'CAESAR',
      language: 'uk',
      ciphertext: 'ххх',
      cipherParams: { shift: 3 },
      tier: 1,
    });
    expect(hint).toBe('Найчастіша літера шифротексту: «х» (зустрічається 3 разів).');
  });
});

describe('listModules', () => {
  it('lists all three modules with their difficulties', () => {
    const modules = listModules();
    expect(modules.map((m) => m.id).sort()).toEqual(['CAESAR', 'FREQUENCY', 'TRANSPOSITION']);
    for (const module of modules) {
      expect(module.difficulties).toEqual(['EASY', 'MEDIUM', 'HARD']);
      expect(module.slug).toBe(module.id.toLowerCase());
    }
  });
});
