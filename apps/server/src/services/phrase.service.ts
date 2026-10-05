import type { CipherModule, Difficulty, Language } from '@shiftcrack/shared';
import { getAlphabet, normalizeText, preparePlaintext, randomIntInRange, sha256Hex } from '../lib/text.js';
import { caesarDecrypt, caesarEncrypt, generateCaesarShift } from './ciphers/caesar.js';
import { generateSubstitution, substitute } from './ciphers/substitution.js';
import { generateRouteParams, routeDecrypt, routeEncrypt } from './ciphers/transposition.js';
import type { RouteKind } from './ciphers/transposition.js';
import type { CorpusPhrase } from './phrases/corpus.js';
import * as enCorpus from './phrases/en.js';
import * as ukCorpus from './phrases/uk.js';

/**
 * Phrase service: picks a phrase for the requested module/difficulty/
 * language and produces the full challenge. The plaintext itself is never
 * persisted — only `plaintextHash` (sha256 of the normalized text), the
 * ciphertext and the cipher params (shift / route) that allow the server
 * to decrypt on demand.
 *
 * Phase 6: phrase length is tied to difficulty, so the letter statistics
 * behave like real cryptanalysis material — EASY long (>100 chars, clean
 * stats), MEDIUM short (40–60, noisy), HARD very short (20–30, solid
 * stream). Each phrase also carries a thematic `context` (e.g. "Військовий
 * наказ") which is metadata, not plaintext — it may be stored and hinted.
 *
 * Exception: TRANSPOSITION ignores the difficulty tags and selects by
 * letters-only length instead — the player traces every letter with the
 * mouse, so route challenges stay short: EASY 15–30, MEDIUM 30–50,
 * HARD 50+ letters.
 */

export interface GeneratedChallenge {
  /** Original, human-readable phrase (never persisted, never sent early). */
  plaintext: string;
  plaintextHash: string;
  ciphertext: string;
  cipherParams: Record<string, unknown>;
  /** Thematic context of the phrase (metadata, never the plaintext itself). */
  context: string | null;
}

/** Letters-only length bands for the route cipher (tracing workload). */
const TRANSPOSITION_LENGTHS: Record<Difficulty, { min: number; max: number }> = {
  EASY: { min: 15, max: 30 },
  MEDIUM: { min: 30, max: 50 },
  HARD: { min: 50, max: Number.POSITIVE_INFINITY },
};

function getCorpus(language: Language, difficulty: Difficulty, module: CipherModule): CorpusPhrase[] {
  const corpus = language === 'uk' ? ukCorpus : enCorpus;
  if (module === 'TRANSPOSITION') {
    const band = TRANSPOSITION_LENGTHS[difficulty];
    const alphabet = getAlphabet(language);
    return corpus.phrases.filter((phrase) => {
      const length = normalizeText(phrase.text, alphabet).length;
      return length >= band.min && length <= band.max;
    });
  }
  return corpus.phrases.filter((phrase) => phrase.difficulty === difficulty);
}

function pickPhrase(corpus: CorpusPhrase[]): CorpusPhrase {
  if (corpus.length === 0) {
    throw new Error('Corpus pool is empty for the requested module/difficulty');
  }
  return corpus[randomIntInRange(0, corpus.length - 1)]!;
}

/** First word of the raw phrase — server-side hint metadata, never sent. */
function firstWordOf(text: string): string {
  return text.trim().split(/\s+/)[0] ?? '';
}

export function generateChallenge(input: {
  module: CipherModule;
  difficulty: Difficulty;
  language: Language;
}): GeneratedChallenge {
  const alphabet = getAlphabet(input.language);
  const phrase = pickPhrase(getCorpus(input.language, input.difficulty, input.module));
  const plaintext = phrase.text;
  // Difficulty scaling: what gets encrypted is decided by the chosen level
  // (EASY keeps word structure, MEDIUM strips punctuation, HARD is a solid
  // letter stream) — EXCEPT the route cipher, whose grid must always hold a
  // solid block of letters regardless of difficulty (grid cells and the
  // mouse trace are letter-only by design). The hash always covers the
  // letters-only stream, so the answer check accepts both "with spaces"
  // and "solid" player input.
  const prepared =
    input.module === 'TRANSPOSITION'
      ? normalizeText(plaintext, alphabet)
      : preparePlaintext(plaintext, alphabet, input.difficulty);
  const plaintextHash = sha256Hex(normalizeText(prepared, alphabet));

  let ciphertext: string;
  let cipherParams: Record<string, unknown>;

  switch (input.module) {
    case 'CAESAR': {
      const shift = generateCaesarShift(input.difficulty, alphabet.length);
      ciphertext = caesarEncrypt(prepared, shift, alphabet);
      cipherParams = { shift };
      break;
    }
    case 'TRANSPOSITION': {
      const params = generateRouteParams(input.difficulty);
      // Filler is an alphabet letter so the ciphertext remains a solid
      // rectangular letter stream; `length` lets decryption cut the
      // padding exactly; `firstWord` powers the tier-3 hint (the plaintext
      // itself is never stored).
      ciphertext = routeEncrypt(prepared, params.cols, params.route, alphabet[alphabet.length - 1]!);
      cipherParams = {
        route: params.route,
        cols: params.cols,
        length: prepared.length,
        firstWord: firstWordOf(plaintext),
      };
      break;
    }
    case 'FREQUENCY': {
      const cipherAlphabet = generateSubstitution(alphabet);
      ciphertext = substitute(prepared, alphabet, cipherAlphabet, 'encrypt');
      cipherParams = { alphabet: cipherAlphabet };
      break;
    }
  }

  return { plaintext, plaintextHash, ciphertext, cipherParams, context: phrase.context };
}

/** Recover the plaintext from stored ciphertext + params (server-side only). */
export function decryptCiphertext(
  ciphertext: string,
  module: CipherModule,
  cipherParams: Record<string, unknown>,
  language: Language,
): string {
  const alphabet = getAlphabet(language);
  switch (module) {
    case 'CAESAR':
      return caesarDecrypt(ciphertext, Number(cipherParams.shift), alphabet);
    case 'TRANSPOSITION':
      return routeDecrypt(
        ciphertext,
        Number(cipherParams.cols),
        cipherParams.route as RouteKind,
        Number(cipherParams.length ?? ciphertext.length),
      );
    case 'FREQUENCY':
      return substitute(ciphertext, alphabet, cipherParams.alphabet as string, 'decrypt');
  }
}
