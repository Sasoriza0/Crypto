import type { CipherModule, Difficulty, Language } from '@shiftcrack/shared';
import { getAlphabet } from '../lib/text.js';
import { decryptCiphertext } from './phrase.service.js';

/**
 * Hint tiers. The number of available hints is inversely proportional to
 * difficulty (SDD §4): EASY 3, MEDIUM 2, HARD 1. Every tier leaks a bit
 * more about the plaintext and costs a scoring penalty (applied by the
 * game service via `hintsUsed`).
 */

export function getMaxHints(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'EASY':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'HARD':
      return 1;
  }
}

interface HintMessages {
  mostFrequent: (letter: string, count: number) => string;
  firstLetter: (letter: string) => string;
  firstWord: (word: string) => string;
}

const MESSAGES: Record<Language, HintMessages> = {
  uk: {
    mostFrequent: (l, c) => `Найчастіша літера шифротексту: «${l}» (зустрічається ${c} разів).`,
    firstLetter: (l) => `Перша літера відкритого тексту: «${l}».`,
    firstWord: (w) => `Перше слово відкритого тексту: «${w}».`,
  },
  en: {
    mostFrequent: (l, c) => `Most frequent ciphertext letter: "${l}" (occurs ${c} times).`,
    firstLetter: (l) => `The first letter of the plaintext is: "${l}".`,
    firstWord: (w) => `The first word of the plaintext is: "${w}".`,
  },
};

export interface HintInput {
  module: CipherModule;
  language: Language;
  ciphertext: string;
  cipherParams: Record<string, unknown>;
  /** 1-based tier, at most getMaxHints(difficulty). */
  tier: number;
}

export function buildHint({ module, language, ciphertext, cipherParams, tier }: HintInput): string {
  const messages = MESSAGES[language];
  const alphabet = getAlphabet(language);

  if (tier === 1) {
    const counts = new Map<string, number>();
    for (const ch of ciphertext) {
      if (alphabet.includes(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    let best = '?';
    let bestCount = 0;
    for (const [letter, count] of counts) {
      if (count > bestCount) {
        best = letter;
        bestCount = count;
      }
    }
    return messages.mostFrequent(best, bestCount);
  }

  const plaintext = decryptCiphertext(ciphertext, module, cipherParams, language);
  const words = plaintext.split(' ');

  if (tier === 2) {
    return messages.firstLetter(plaintext[0] ?? '?');
  }
  return messages.firstWord(words[0] ?? '?');
}
