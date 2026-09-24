import type { CipherModule, Difficulty, Language } from '@shiftcrack/shared';
import { getAlphabet, normalizeText, randomIntInRange, sha256Hex } from '../lib/text.js';
import { caesarDecrypt, caesarEncrypt, generateCaesarShift } from './ciphers/caesar.js';
import { generateSubstitution, substitute } from './ciphers/substitution.js';
import { generateTranspositionKey, transpositionDecrypt, transpositionEncrypt } from './ciphers/transposition.js';
import * as enCorpus from './phrases/en.js';
import * as ukCorpus from './phrases/uk.js';

/**
 * Phrase service: picks a phrase for the requested module/difficulty/
 * language and produces the full challenge. The plaintext itself is never
 * persisted — only `plaintextHash` (sha256 of the normalized text), the
 * ciphertext and the cipher params (shift / permutation) that allow the
 * server to decrypt on demand.
 */

export interface GeneratedChallenge {
  /** Original, human-readable phrase (never persisted, never sent early). */
  plaintext: string;
  plaintextHash: string;
  ciphertext: string;
  cipherParams: Record<string, unknown>;
}

function getCorpus(language: Language, difficulty: Difficulty): string[] {
  const corpus = language === 'uk' ? ukCorpus : enCorpus;
  switch (difficulty) {
    case 'EASY':
      return corpus.easyPhrases;
    case 'MEDIUM':
      return corpus.mediumPhrases;
    case 'HARD':
      return corpus.hardPhrases;
  }
}

function pickPhrase(corpus: string[]): string {
  return corpus[randomIntInRange(0, corpus.length - 1)]!;
}

export function generateChallenge(input: {
  module: CipherModule;
  difficulty: Difficulty;
  language: Language;
}): GeneratedChallenge {
  const alphabet = getAlphabet(input.language);
  const plaintext = pickPhrase(getCorpus(input.language, input.difficulty));
  const normalized = normalizeText(plaintext, alphabet);
  const plaintextHash = sha256Hex(normalized);

  let ciphertext: string;
  let cipherParams: Record<string, unknown>;

  switch (input.module) {
    case 'CAESAR': {
      const shift = generateCaesarShift(input.difficulty, alphabet.length);
      ciphertext = caesarEncrypt(normalized, shift, alphabet);
      cipherParams = { shift };
      break;
    }
    case 'TRANSPOSITION': {
      const key = generateTranspositionKey(input.difficulty);
      ciphertext = transpositionEncrypt(normalized, key);
      cipherParams = { key };
      break;
    }
    case 'FREQUENCY': {
      const cipherAlphabet = generateSubstitution(alphabet);
      ciphertext = substitute(normalized, alphabet, cipherAlphabet, 'encrypt');
      cipherParams = { alphabet: cipherAlphabet };
      break;
    }
  }

  return { plaintext, plaintextHash, ciphertext, cipherParams };
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
      return transpositionDecrypt(ciphertext, cipherParams.key as number[]);
    case 'FREQUENCY':
      return substitute(ciphertext, alphabet, cipherParams.alphabet as string, 'decrypt');
  }
}
