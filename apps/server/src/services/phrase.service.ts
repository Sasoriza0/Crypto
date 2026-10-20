import type { CipherModule, Language } from '@shiftcrack/shared';
import { getAlphabet, normalizeText, preparePlaintext, randomIntInRange, sha256Hex } from '../lib/text.js';
import { caesarDecrypt, caesarEncrypt, generateCaesarShift } from './ciphers/caesar.js';
import { generateChimeraChallenge } from './ciphers/chimera.js';
import { generateSubstitution, substitute } from './ciphers/substitution.js';
import { generateRouteParams, routeDecrypt, routeEncrypt } from './ciphers/transposition.js';
import { generateVigenereKey, vigenereDecrypt, vigenereEncrypt } from './ciphers/vigenere.js';
import type { RouteKind } from './ciphers/transposition.js';
import type { CorpusPhrase } from './phrases/corpus.js';
import * as enCorpus from './phrases/en.js';
import * as ukCorpus from './phrases/uk.js';

/**
 * Phrase service: picks a phrase for the requested module/language and
 * produces the full challenge. The plaintext itself is never persisted —
 * only `plaintextHash` (sha256 of the normalized text), the ciphertext and
 * the cipher params (shift / route / key) that allow the server to decrypt
 * on demand.
 *
 * Story-fixed missions (legacy EASY/MEDIUM/HARD scaling removed):
 * - CAESAR draws from the balanced 40–60 char pool — long enough for real
 *   letter statistics, short enough for the wheel;
 * - FREQUENCY always selects LONG texts (3–5 sentences, 120+ letters):
 *   substitution cracking needs a large statistical sample;
 * - VIGENERE also uses the long-text pool (the Kasiski attack needs
 *   enough material for repeated n-grams to appear) and always keeps
 *   spaces between words, so the ciphertext reads like a real intercepted
 *   message;
 * - TRANSPOSITION uses INVERTED grid generation: the dimensions are rolled
 *   first (random 3–7 columns × random 3–7 rows), then the text is fit to
 *   the cols×rows grid — longer phrases are truncated, shorter ones are
 *   padded with traditional dummy letters («х»/«о» for Cyrillic, «x» for
 *   Latin). The phrase pool prefers texts near the target length so the
 *   truncation/padding stays minimal.
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

/** FREQUENCY/VIGENERE need 3–5 sentences of statistics — 120+ letters minimum. */
const FREQUENCY_MIN_LETTERS = 120;

/** CAESAR: the balanced story pool (40–60 raw chars). */
const CAESAR_DIFFICULTY = 'MEDIUM' as const;

function getCorpus(language: Language, module: CipherModule): CorpusPhrase[] {
  const corpus = language === 'uk' ? ukCorpus : enCorpus;
  const alphabet = getAlphabet(language);
  if (module === 'FREQUENCY' || module === 'VIGENERE') {
    return corpus.phrases.filter(
      (phrase) => normalizeText(phrase.text, alphabet).length >= FREQUENCY_MIN_LETTERS,
    );
  }
  if (module === 'CAESAR') {
    return corpus.phrases.filter((phrase) => phrase.difficulty === CAESAR_DIFFICULTY);
  }
  return corpus.phrases;
}

function pickPhrase(corpus: CorpusPhrase[]): CorpusPhrase {
  if (corpus.length === 0) {
    throw new Error('Corpus pool is empty for the requested module');
  }
  return corpus[randomIntInRange(0, corpus.length - 1)]!;
}

/** First word of the raw phrase — server-side hint metadata, never sent. */
function firstWordOf(text: string): string {
  return text.trim().split(/\s+/)[0] ?? '';
}

/** Traditional route-cipher padding: «х»/«о» alternate for Cyrillic, «x» for Latin. */
function dummyFiller(language: Language, offset: number): string {
  return language === 'uk' ? (offset % 2 === 0 ? 'х' : 'о') : 'x';
}

/**
 * Fit a letters-only stream into a cols×rows grid: text longer than the
 * grid is truncated, shorter text is padded with dummy letters. Returns
 * the exact grid text and the REAL content length (padding excluded) so
 * decryption, the client candidate and the answer hash cut the dummies
 * off exactly.
 */
function fitToGrid(text: string, targetLength: number, language: Language): { grid: string; realLength: number } {
  if (text.length >= targetLength) {
    return { grid: text.slice(0, targetLength), realLength: targetLength };
  }
  let grid = text;
  for (let i = 0; grid.length < targetLength; i++) {
    grid += dummyFiller(language, i);
  }
  return { grid, realLength: text.length };
}

/**
 * Pick a phrase close to the target grid size: prefer phrases that FIT
 * (length ≤ target — they are padded, never cut, so the message stays
 * whole), taking the longest fitting ones for minimal padding. Only when
 * no phrase fits (tiny grids) fall back to the closest longer phrase,
 * which gets truncated.
 */
function pickTranspositionPhrase(corpus: CorpusPhrase[], alphabet: string, targetLength: number): CorpusPhrase {
  if (corpus.length === 0) {
    throw new Error('Corpus pool is empty for the requested module');
  }
  const withLength = corpus.map((phrase) => ({
    phrase,
    length: normalizeText(phrase.text, alphabet).length,
  }));
  const fitting = withLength.filter((entry) => entry.length <= targetLength);
  const pool = fitting.length > 0 ? fitting : withLength;
  const sorted = [...pool].sort(
    (a, b) => Math.abs(a.length - targetLength) - Math.abs(b.length - targetLength),
  );
  const best = Math.abs(sorted[0]!.length - targetLength);
  const candidates = sorted.filter((entry) => Math.abs(entry.length - targetLength) <= best + 2);
  return candidates[randomIntInRange(0, candidates.length - 1)]!.phrase;
}

/**
 * TRANSPOSITION challenge (inverted grid generation): 1) roll random
 * 3–7 columns and 3–7 rows, 2) targetLength = cols × rows, 3) take a
 * phrase from the pool and fit it to the grid (truncate / dummy-pad),
 * 4) run the existing route permutation. `cipherParams.length` tracks the
 * real content, so the answer hash and the client candidate never include
 * the dummies.
 */
function generateTranspositionChallenge(language: Language, alphabet: string): GeneratedChallenge {
  const params = generateRouteParams();
  const targetLength = params.cols * params.rows;
  const corpus = language === 'uk' ? ukCorpus.phrases : enCorpus.phrases;
  const phrase = pickTranspositionPhrase(corpus, alphabet, targetLength);
  const letters = normalizeText(phrase.text, alphabet);
  const { grid, realLength } = fitToGrid(letters, targetLength, language);
  const ciphertext = routeEncrypt(grid, params.cols, params.route, alphabet[alphabet.length - 1]!);
  return {
    plaintext: phrase.text,
    plaintextHash: sha256Hex(normalizeText(grid.slice(0, realLength), alphabet)),
    ciphertext,
    cipherParams: {
      route: params.route,
      cols: params.cols,
      rows: params.rows,
      length: realLength,
      firstWord: firstWordOf(phrase.text),
    },
    context: phrase.context,
  };
}

export function generateChallenge(input: { module: CipherModule; language: Language }): GeneratedChallenge {
  // CHIMERA (Mission 05) is a three-phase composite challenge with no
  // corpus phrase: the "plaintext" is the target JSON assembled from the
  // MitM / AES-ECB / JWT phases (see ciphers/chimera.ts).
  if (input.module === 'CHIMERA') {
    return generateChimeraChallenge();
  }

  const alphabet = getAlphabet(input.language);
  if (input.module === 'TRANSPOSITION') {
    return generateTranspositionChallenge(input.language, alphabet);
  }

  const phrase = pickPhrase(getCorpus(input.language, input.module));
  const plaintext = phrase.text;
  // Fixed balanced preparation: punctuation stripped, spaces kept — the
  // ciphertext reads like a real intercepted message for every module.
  // The hash always covers the letters-only stream, so the answer check
  // accepts both "with spaces" and "solid" player input.
  const prepared = preparePlaintext(plaintext, alphabet);
  const plaintextHash = sha256Hex(normalizeText(prepared, alphabet));

  let ciphertext: string;
  let cipherParams: Record<string, unknown>;

  switch (input.module) {
    case 'CAESAR': {
      const shift = generateCaesarShift(alphabet.length);
      ciphertext = caesarEncrypt(prepared, shift, alphabet);
      cipherParams = { shift };
      break;
    }
    case 'FREQUENCY': {
      const cipherAlphabet = generateSubstitution(alphabet);
      ciphertext = substitute(prepared, alphabet, cipherAlphabet, 'encrypt');
      cipherParams = { alphabet: cipherAlphabet };
      break;
    }
    case 'VIGENERE': {
      const key = generateVigenereKey(input.language);
      ciphertext = vigenereEncrypt(prepared, key, alphabet);
      cipherParams = { key };
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
    case 'VIGENERE':
      return vigenereDecrypt(ciphertext, String(cipherParams.key ?? ''), alphabet);
    case 'CHIMERA':
      // CHIMERA is never decrypted from cipher params — the target JSON is
      // sealed in the params and revealed only after all three phases.
      throw new Error('CHIMERA plaintext is not derivable from cipher params alone');
  }
}
