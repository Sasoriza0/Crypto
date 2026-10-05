import { describe, expect, it } from 'vitest';
import type { Difficulty } from '@shiftcrack/shared';
import { getAlphabet, normalizeText, preparePlaintext, sha256Hex } from '../src/lib/text.js';
import { decryptCiphertext, generateChallenge } from '../src/services/phrase.service.js';

/**
 * SDD Phase 5 difficulty scaling: EASY keeps spaces + punctuation (word
 * structure visible), MEDIUM strips punctuation but keeps spaces, HARD is
 * a solid letter stream. Exception: TRANSPOSITION always encrypts the
 * letters-only stream — grid cells and the trace are letter-only by design.
 * The plaintext hash always covers the letters-only stream, so
 * submitAttempt accepts answers typed either way.
 */
describe('preparePlaintext — difficulty scaling', () => {
  const alphabet = getAlphabet('uk');

  it('EASY keeps spaces and punctuation', () => {
    expect(preparePlaintext('  Слава, Україні! ', alphabet, 'EASY')).toBe('  слава, україні! ');
  });

  it('MEDIUM strips punctuation but keeps spaces', () => {
    expect(preparePlaintext('Слава, Україні!', alphabet, 'MEDIUM')).toBe('слава україні');
  });

  it('HARD strips everything to a solid letter stream', () => {
    expect(preparePlaintext('Слава, Україні!', alphabet, 'HARD')).toBe('славаукраїні');
  });
});

describe('generateChallenge — difficulty-scaling invariants', () => {
  const modules = ['CAESAR', 'TRANSPOSITION', 'FREQUENCY'] as const;
  const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  for (const module of modules) {
    for (const difficulty of difficulties) {
      it(`${module} ${difficulty}: encrypt/decrypt round-trip over the prepared text`, () => {
        const language = 'uk';
        const challenge = generateChallenge({ module, difficulty, language });
        const alphabet = getAlphabet(language);
        // TRANSPOSITION always encrypts the solid letters-only stream;
        // the other modules scale by difficulty (EASY keeps word structure).
        const prepared =
          module === 'TRANSPOSITION'
            ? normalizeText(challenge.plaintext, alphabet)
            : preparePlaintext(challenge.plaintext, alphabet, difficulty);

        // decryption returns exactly the text that was encrypted
        expect(decryptCiphertext(challenge.ciphertext, module, challenge.cipherParams, language)).toBe(
          prepared,
        );

        // the hash covers the letters-only stream regardless of difficulty
        expect(challenge.plaintextHash).toBe(sha256Hex(normalizeText(prepared, alphabet)));
      });
    }
  }

  it('HARD ciphertexts are solid letter streams with no whitespace', () => {
    for (const module of modules) {
      const challenge = generateChallenge({ module, difficulty: 'HARD', language: 'uk' });
      expect(challenge.ciphertext).not.toMatch(/\s/);
    }
  });

  it('MEDIUM ciphertexts keep word structure: letters and spaces only', () => {
    const alphabet = getAlphabet('uk');
    for (const module of ['CAESAR', 'FREQUENCY'] as const) {
      const challenge = generateChallenge({ module, difficulty: 'MEDIUM', language: 'uk' });
      expect(challenge.ciphertext).toMatch(/\s/);
      for (const ch of challenge.ciphertext) {
        expect(alphabet.includes(ch) || ch === ' ').toBe(true);
      }
    }
  });

  it('EASY ciphertexts preserve punctuation as-is (lowercased)', () => {
    for (const module of ['CAESAR', 'FREQUENCY'] as const) {
      const challenge = generateChallenge({ module, difficulty: 'EASY', language: 'uk' });
      expect(decryptCiphertext(challenge.ciphertext, module, challenge.cipherParams, 'uk')).toBe(
        challenge.plaintext.toLowerCase(),
      );
    }
  });

  it('TRANSPOSITION ciphertexts are solid letter streams on every difficulty', () => {
    const alphabet = getAlphabet('uk');
    for (const difficulty of difficulties) {
      const challenge = generateChallenge({ module: 'TRANSPOSITION', difficulty, language: 'uk' });
      expect(challenge.ciphertext).not.toMatch(/\s/);
      for (const ch of challenge.ciphertext) {
        expect(alphabet.includes(ch)).toBe(true);
      }
      expect(challenge.cipherParams.firstWord).toBeTruthy();
    }
  });
});

describe('generateChallenge — Phase 6 difficulty length buckets', () => {
  const statisticsModules = ['CAESAR', 'FREQUENCY'] as const;
  const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  it('CAESAR/FREQUENCY: EASY >100, MEDIUM 40–60, HARD 20–30 raw chars', () => {
    for (const module of statisticsModules) {
      for (const difficulty of difficulties) {
        const challenge = generateChallenge({ module, difficulty, language: 'uk' });
        if (difficulty === 'EASY') {
          expect(challenge.plaintext.length).toBeGreaterThan(100);
        } else if (difficulty === 'MEDIUM') {
          expect(challenge.plaintext.length).toBeGreaterThanOrEqual(40);
          expect(challenge.plaintext.length).toBeLessThanOrEqual(60);
        } else {
          expect(challenge.plaintext.length).toBeGreaterThanOrEqual(20);
          expect(challenge.plaintext.length).toBeLessThanOrEqual(30);
          expect(challenge.ciphertext).not.toMatch(/\s/);
        }
      }
    }
  });

  it('TRANSPOSITION: EASY 15–30, MEDIUM 30–50, HARD 50+ letters (route tracing stays short)', () => {
    const alphabet = getAlphabet('uk');
    for (const difficulty of difficulties) {
      const challenge = generateChallenge({ module: 'TRANSPOSITION', difficulty, language: 'uk' });
      const letters = normalizeText(challenge.plaintext, alphabet).length;
      if (difficulty === 'EASY') {
        expect(letters).toBeGreaterThanOrEqual(15);
        expect(letters).toBeLessThanOrEqual(30);
      } else if (difficulty === 'MEDIUM') {
        expect(letters).toBeGreaterThanOrEqual(30);
        expect(letters).toBeLessThanOrEqual(50);
      } else {
        expect(letters).toBeGreaterThanOrEqual(50);
      }
    }
  });

  it('every challenge carries a thematic context (uk and en)', () => {
    for (const language of ['uk', 'en'] as const) {
      for (const difficulty of difficulties) {
        const challenge = generateChallenge({ module: 'CAESAR', difficulty, language });
        expect(challenge.context).toBeTruthy();
      }
    }
  });
});
