import { describe, expect, it } from 'vitest';
import { getAlphabet, normalizeText, preparePlaintext, sha256Hex } from '../src/lib/text.js';
import { revealPlaintext } from '../src/services/game.service.js';
import { CAESAR_SHIFT_MAX, CAESAR_SHIFT_MIN } from '../src/services/ciphers/caesar.js';
import { VIGENERE_KEY_MAX, VIGENERE_KEY_MIN } from '../src/services/ciphers/vigenere.js';
import { decryptCiphertext, generateChallenge } from '../src/services/phrase.service.js';
import * as ukCorpus from '../src/services/phrases/uk.js';

/**
 * Story-fixed missions (legacy EASY/MEDIUM/HARD scaling removed): every
 * challenge follows one balanced profile — fixed text preparation
 * (lowercase, punctuation stripped, spaces kept), CAESAR drawn from the
 * 40–60 char pool with shifts 4–15, VIGENERE keys 5–6 letters, and
 * TRANSPOSITION still using inverted grid generation (random 3–7 columns ×
 * 3–7 rows with dummy padding). The plaintext hash always covers the
 * letters-only stream, so submitAttempt accepts answers typed either way.
 */
describe('preparePlaintext — fixed balanced preparation', () => {
  const alphabet = getAlphabet('uk');

  it('lowercases and strips punctuation while keeping spaces', () => {
    expect(preparePlaintext('  Слава, Україні! ', alphabet)).toBe('  слава україні ');
  });

  it('drops letters outside the alphabet but keeps word gaps', () => {
    expect(preparePlaintext('тест test!', alphabet)).toBe('тест ');
  });

  it('is idempotent over already prepared text', () => {
    expect(preparePlaintext('слава україні', alphabet)).toBe('слава україні');
  });
});

describe('generateChallenge — fixed-profile invariants', () => {
  const languages = ['uk', 'en'] as const;
  const modules = ['CAESAR', 'TRANSPOSITION', 'FREQUENCY', 'VIGENERE'] as const;

  for (const language of languages) {
    for (const module of modules) {
      it(`${module} (${language}): encrypt/decrypt round-trip over the prepared text`, () => {
        const challenge = generateChallenge({ module, language });
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
          // CAESAR/FREQUENCY/VIGENERE all use the fixed prepared text.
          expect(decrypted).toBe(preparePlaintext(challenge.plaintext, alphabet));
        }

        // the hash covers the letters-only real content regardless of module
        expect(challenge.plaintextHash).toBe(sha256Hex(normalizeText(decrypted, alphabet)));
      });
    }
  }

  it('CAESAR: phrases come from the balanced 40–60 char pool with shifts 4–15', () => {
    for (const language of languages) {
      for (let i = 0; i < 20; i++) {
        const challenge = generateChallenge({ module: 'CAESAR', language });
        expect(challenge.plaintext.length).toBeGreaterThanOrEqual(40);
        expect(challenge.plaintext.length).toBeLessThanOrEqual(60);
        const shift = Number(challenge.cipherParams.shift);
        expect(shift).toBeGreaterThanOrEqual(CAESAR_SHIFT_MIN);
        expect(shift).toBeLessThanOrEqual(CAESAR_SHIFT_MAX);
      }
    }
  });

  it('FREQUENCY: always long texts (120+ letters, 3–5 sentences) with word structure', () => {
    for (const language of languages) {
      for (let i = 0; i < 5; i++) {
        const challenge = generateChallenge({ module: 'FREQUENCY', language });
        const alphabet = getAlphabet(language);
        expect(normalizeText(challenge.plaintext, alphabet).length).toBeGreaterThanOrEqual(120);
        expect(challenge.ciphertext).toMatch(/\s/);
        for (const ch of challenge.ciphertext) {
          expect(alphabet.includes(ch) || ch === ' ').toBe(true);
        }
      }
    }
  });

  it('VIGENERE: long texts (120+ letters), word structure, fixed 5–6 letter keys', () => {
    for (const language of languages) {
      for (let i = 0; i < 5; i++) {
        const challenge = generateChallenge({ module: 'VIGENERE', language });
        const alphabet = getAlphabet(language);
        // Kasiski needs a large sample of the message…
        expect(normalizeText(challenge.plaintext, alphabet).length).toBeGreaterThanOrEqual(120);
        // …and the ciphertext must read like a real intercepted message
        expect(challenge.ciphertext).toMatch(/\s/);
        for (const ch of challenge.ciphertext) {
          expect(alphabet.includes(ch) || ch === ' ').toBe(true);
        }
        // the key word length follows the fixed balanced profile
        const key = String(challenge.cipherParams.key);
        expect(key.length).toBeGreaterThanOrEqual(VIGENERE_KEY_MIN);
        expect(key.length).toBeLessThanOrEqual(VIGENERE_KEY_MAX);
        for (const ch of key) {
          expect(alphabet.includes(ch)).toBe(true);
        }
      }
    }
  });

  it('TRANSPOSITION: solid streams, 3–7 grid, real content never longer than the grid', () => {
    for (const language of languages) {
      const alphabet = getAlphabet(language);
      for (let i = 0; i < 20; i++) {
        const challenge = generateChallenge({ module: 'TRANSPOSITION', language });
        const cols = Number(challenge.cipherParams.cols);
        const rows = Number(challenge.cipherParams.rows);
        expect(Number.isInteger(cols) && cols >= 3 && cols <= 7).toBe(true);
        expect(Number.isInteger(rows) && rows >= 3 && rows <= 7).toBe(true);
        expect(challenge.ciphertext).not.toMatch(/\s/);
        expect(challenge.ciphertext.length).toBe(cols * rows);
        expect(Number(challenge.cipherParams.length)).toBeLessThanOrEqual(cols * rows);
        expect(Number(challenge.cipherParams.length)).toBeGreaterThan(0);
        expect(challenge.cipherParams.firstWord).toBeTruthy();
        for (const ch of challenge.ciphertext) {
          expect(alphabet.includes(ch)).toBe(true);
        }
      }
    }
  });

  it('every challenge carries a thematic context (uk and en)', () => {
    for (const language of languages) {
      for (const module of modules) {
        const challenge = generateChallenge({ module, language });
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
      const challenge = generateChallenge({ module: 'TRANSPOSITION', language: 'uk' });
      const decrypted = decryptCiphertext(challenge.ciphertext, 'TRANSPOSITION', challenge.cipherParams, 'uk');
      const stream = normalizeText(challenge.plaintext, getAlphabet('uk'));
      if (decrypted === stream) {
        expect(revealPlaintext('uk', decrypted)).toBe(challenge.plaintext);
      }
    }
  });

  it('recovers the original text for FREQUENCY sessions', () => {
    const challenge = generateChallenge({ module: 'FREQUENCY', language: 'uk' });
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
