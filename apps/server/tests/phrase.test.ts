import { describe, expect, it } from 'vitest';
import type { Difficulty } from '@shiftcrack/shared';
import { getAlphabet, normalizeText, preparePlaintext, sha256Hex } from '../src/lib/text.js';
import { revealPlaintext } from '../src/services/game.service.js';
import { decryptCiphertext, generateChallenge } from '../src/services/phrase.service.js';
import * as ukCorpus from '../src/services/phrases/uk.js';

/**
 * SDD Phase 5 difficulty scaling: EASY keeps spaces + punctuation (word
 * structure visible), MEDIUM strips punctuation but keeps spaces, HARD is
 * a solid letter stream. Exceptions: TRANSPOSITION uses inverted grid
 * generation — random 3–7 columns × 3–7 rows first, then the text is fit
 * to the cols×rows grid (truncated or dummy-padded, always a solid letter
 * stream); FREQUENCY keeps word structure even at HARD (its mission is
 * fixed at HARD, and word boundaries are essential for substitution work).
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
  const modules = ['CAESAR', 'TRANSPOSITION', 'FREQUENCY', 'VIGENERE'] as const;
  const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  for (const module of modules) {
    for (const difficulty of difficulties) {
      it(`${module} ${difficulty}: encrypt/decrypt round-trip over the prepared text`, () => {
        const language = 'uk';
        const challenge = generateChallenge({ module, difficulty, language });
        const alphabet = getAlphabet(language);
        const decrypted = decryptCiphertext(challenge.ciphertext, module, challenge.cipherParams, language);

        if (module === 'TRANSPOSITION') {
          // Inverted grid generation: the real content is a prefix of the
          // phrase's letter stream (truncated or dummy-padded to cols×rows),
          // and `length` marks exactly where the dummies stop.
          const stream = normalizeText(challenge.plaintext, alphabet);
          expect(stream.startsWith(decrypted)).toBe(true);
          expect(decrypted.length).toBe(Number(challenge.cipherParams.length));
        } else {
          // FREQUENCY keeps word structure at HARD (its mission is fixed
          // there) and VIGENERE keeps it at every difficulty (the Kasiski
          // tool needs word boundaries); the rest scale by difficulty.
          const prepared =
            (module === 'FREQUENCY' && difficulty === 'HARD') || module === 'VIGENERE'
              ? preparePlaintext(challenge.plaintext, alphabet, 'MEDIUM')
              : preparePlaintext(challenge.plaintext, alphabet, difficulty);
          expect(decrypted).toBe(prepared);
        }

        // the hash covers the letters-only real content regardless of difficulty
        expect(challenge.plaintextHash).toBe(sha256Hex(normalizeText(decrypted, alphabet)));
      });
    }
  }

  it('HARD ciphertexts are solid letter streams with no whitespace (CAESAR, TRANSPOSITION)', () => {
    for (const module of ['CAESAR', 'TRANSPOSITION'] as const) {
      const challenge = generateChallenge({ module, difficulty: 'HARD', language: 'uk' });
      expect(challenge.ciphertext).not.toMatch(/\s/);
    }
  });

  it('FREQUENCY HARD keeps word structure: letters and spaces only', () => {
    const alphabet = getAlphabet('uk');
    const challenge = generateChallenge({ module: 'FREQUENCY', difficulty: 'HARD', language: 'uk' });
    expect(challenge.ciphertext).toMatch(/\s/);
    for (const ch of challenge.ciphertext) {
      expect(alphabet.includes(ch) || ch === ' ').toBe(true);
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

  it('TRANSPOSITION: the grid rolls independently in 3–7 columns and 3–7 rows', () => {
    const alphabet = getAlphabet('uk');
    for (const difficulty of difficulties) {
      for (let i = 0; i < 20; i++) {
        const challenge = generateChallenge({ module: 'TRANSPOSITION', difficulty, language: 'uk' });
        const cols = Number(challenge.cipherParams.cols);
        const rows = Number(challenge.cipherParams.rows);
        expect(Number.isInteger(cols) && cols >= 3 && cols <= 7).toBe(true);
        expect(Number.isInteger(rows) && rows >= 3 && rows <= 7).toBe(true);
        // the ciphertext fills the rolled grid exactly — a perfect rectangle
        expect(challenge.ciphertext.length).toBe(cols * rows);
        // the real content is never longer than the grid
        expect(Number(challenge.cipherParams.length)).toBeLessThanOrEqual(cols * rows);
        expect(Number(challenge.cipherParams.length)).toBeGreaterThan(0);
        // still a solid stream of alphabet letters only (dummies included)
        for (const ch of challenge.ciphertext) {
          expect(alphabet.includes(ch)).toBe(true);
        }
      }
    }
  });
});

describe('generateChallenge — Phase 6 difficulty length buckets', () => {
  const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  it('CAESAR: EASY >100, MEDIUM 40–60, HARD 20–30 raw chars', () => {
    for (const difficulty of difficulties) {
      const challenge = generateChallenge({ module: 'CAESAR', difficulty, language: 'uk' });
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
  });

  it('FREQUENCY: always long texts (120+ letters, 3–5 sentences) regardless of difficulty', () => {
    for (const language of ['uk', 'en'] as const) {
      for (const difficulty of difficulties) {
        const challenge = generateChallenge({ module: 'FREQUENCY', difficulty, language });
        expect(normalizeText(challenge.plaintext, getAlphabet(language)).length).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it('VIGENERE: long texts (120+ letters) with word structure at every difficulty', () => {
    for (const language of ['uk', 'en'] as const) {
      for (const difficulty of difficulties) {
        const challenge = generateChallenge({ module: 'VIGENERE', difficulty, language });
        const alphabet = getAlphabet(language);
        // Kasiski needs a large sample of the message…
        expect(normalizeText(challenge.plaintext, alphabet).length).toBeGreaterThanOrEqual(120);
        // …and the ciphertext must read like a real intercepted message
        expect(challenge.ciphertext).toMatch(/\s/);
        for (const ch of challenge.ciphertext) {
          expect(alphabet.includes(ch) || ch === ' ').toBe(true);
        }
        // the key word length follows the difficulty tiers
        const key = String(challenge.cipherParams.key);
        const { min, max } = (() => {
          if (difficulty === 'EASY') return { min: 3, max: 4 };
          if (difficulty === 'MEDIUM') return { min: 5, max: 6 };
          return { min: 7, max: 9 };
        })();
        expect(key.length).toBeGreaterThanOrEqual(min);
        expect(key.length).toBeLessThanOrEqual(max);
        for (const ch of key) {
          expect(alphabet.includes(ch)).toBe(true);
        }
        // spaces survive the round-trip exactly where they were
        const decrypted = decryptCiphertext(challenge.ciphertext, 'VIGENERE', challenge.cipherParams, language);
        expect(decrypted).toMatch(/\s/);
        expect(decrypted).toBe(preparePlaintext(challenge.plaintext, alphabet, 'MEDIUM'));
      }
    }
  });

  it('TRANSPOSITION: real content is a prefix of the phrase stream, padded to the grid', () => {
    const alphabet = getAlphabet('uk');
    for (const difficulty of difficulties) {
      for (let i = 0; i < 20; i++) {
        const challenge = generateChallenge({ module: 'TRANSPOSITION', difficulty, language: 'uk' });
        const stream = normalizeText(challenge.plaintext, alphabet);
        const decrypted = decryptCiphertext(challenge.ciphertext, 'TRANSPOSITION', challenge.cipherParams, 'uk');
        // decryption returns exactly the real content (dummies cut off)
        expect(decrypted.length).toBe(Number(challenge.cipherParams.length));
        // the content is either the whole phrase stream or its prefix (truncation)
        expect(stream.startsWith(decrypted)).toBe(true);
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

describe('revealPlaintext — victory screen shows the original text', () => {
  it('recovers the original readable text for a full corpus stream (TRANSPOSITION)', () => {
    const phrase = ukCorpus.phrases[0]!;
    const stream = normalizeText(phrase.text, getAlphabet('uk'));
    // the mechanics work on a solid letters-only stream…
    expect(stream).not.toMatch(/\s/);
    // …but the victory reveal returns the original, readable phrase
    expect(revealPlaintext('uk', stream)).toBe(phrase.text);
  });

  it('TRANSPOSITION padded sessions: reveal matches the phrase while dummies stay hidden', () => {
    // A padded session encrypts the WHOLE phrase stream (plus dummies), so
    // the decrypted real content must map back to the original phrase.
    for (let i = 0; i < 20; i++) {
      const challenge = generateChallenge({ module: 'TRANSPOSITION', difficulty: 'MEDIUM', language: 'uk' });
      const decrypted = decryptCiphertext(challenge.ciphertext, 'TRANSPOSITION', challenge.cipherParams, 'uk');
      const stream = normalizeText(challenge.plaintext, getAlphabet('uk'));
      if (decrypted === stream) {
        expect(revealPlaintext('uk', decrypted)).toBe(challenge.plaintext);
      }
    }
  });

  it('recovers the original text for HARD FREQUENCY sessions', () => {
    const challenge = generateChallenge({ module: 'FREQUENCY', difficulty: 'HARD', language: 'uk' });
    const prepared = decryptCiphertext(challenge.ciphertext, 'FREQUENCY', challenge.cipherParams, 'uk');
    // FREQUENCY keeps word structure in the ciphertext itself…
    expect(prepared).toMatch(/\s/);
    // …and the victory reveal still recovers the full original phrase
    expect(revealPlaintext('uk', prepared)).toBe(challenge.plaintext);
  });

  it('falls back to the prepared text when no corpus phrase matches', () => {
    expect(revealPlaintext('uk', 'такоготекстувкорпусінемає')).toBe('такоготекстувкорпусінемає');
  });
});
