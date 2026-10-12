import type { CipherModule, Difficulty, Language } from '@shiftcrack/shared';
import { getAlphabet } from '../lib/text.js';
import { decryptCiphertext } from './phrase.service.js';
import type { RouteKind } from './ciphers/transposition.js';

/**
 * Hint tiers. The number of available hints is inversely proportional to
 * difficulty (SDD §4): EASY 3, MEDIUM 2, HARD 1. Every tier leaks a bit
 * more about the challenge and costs a scoring penalty (applied by the
 * game service via `hintsUsed`).
 *
 * Each module has a fully isolated hint builder that leaks only
 * module-appropriate information:
 * - CAESAR: tier 1 → most frequent ciphertext letter; tier 2 → first
 *   plaintext letter; tier 3 → first plaintext word.
 * - TRANSPOSITION (route cipher, Phase 6): tier 1 → column count (the
 *   divisor test gets the player started); tier 2 → the fill route;
 *   tier 3 → first plaintext word.
 * - FREQUENCY: one concrete cipher→plain substitution per tier, preferring
 *   letters the player currently maps wrong (when the client submits its
 *   guesses).
 * - VIGENERE: tier 1 → key length (the Kasiski goal); tier 2 → the first
 *   key letter (the first slider of the key-fitting tool); tier 3 → first
 *   plaintext word.
 *
 * On MEDIUM the player may additionally spend one hint on the thematic
 * context clue (stored on the session row); it is priced like any hint
 * but does not advance the crypto tiers (see buildContextHint).
 */

export function getMaxHints(difficulty: Difficulty, module?: CipherModule): number {
  const base = (() => {
    switch (difficulty) {
      case 'EASY':
        return 3;
      case 'MEDIUM':
        return 2;
      case 'HARD':
        return 1;
    }
  })();
  // VIGENERE is the hardest mission (Kasiski period discovery + per-position
  // key fitting), so even at HARD it gets at least two crypto tiers:
  // tier 1 → key length, tier 2 → first key letter.
  if (module === 'VIGENERE') return Math.max(base, 2);
  return base;
}

interface CaesarHintMessages {
  mostFrequent: (letter: string, count: number) => string;
  firstLetter: (letter: string) => string;
  firstWord: (word: string) => string;
}

const CAESAR_MESSAGES: Record<Language, CaesarHintMessages> = {
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

const ROUTE_NAMES: Record<Language, Record<RouteKind, string>> = {
  uk: {
    HORIZONTAL_SNAKE: 'горизонтальна змійка',
    VERTICAL_SNAKE: 'вертикальна змійка',
    SPIRAL_CW: 'спіраль за годинниковою стрілкою',
    SPIRAL_CCW: 'спіраль проти годинникової стрілки',
  },
  en: {
    HORIZONTAL_SNAKE: 'horizontal snake',
    VERTICAL_SNAKE: 'vertical snake',
    SPIRAL_CW: 'clockwise spiral',
    SPIRAL_CCW: 'counterclockwise spiral',
  },
};

const TRANSPOSITION_COLUMNS_MESSAGES: Record<Language, (cols: number) => string> = {
  uk: (cols) => `Правильна кількість колонок: ${cols}.`,
  en: (cols) => `The correct number of columns is ${cols}.`,
};

const TRANSPOSITION_ROUTE_MESSAGES: Record<Language, (route: string) => string> = {
  uk: (route) => `Таблицю було заповнено маршрутом: «${route}».`,
  en: (route) => `The table was filled along the route: "${route}".`,
};

const VIGENERE_KEY_LENGTH_MESSAGES: Record<Language, (length: number) => string> = {
  uk: (length) => `Довжина ключа Віженера: ${length} літер.`,
  en: (length) => `The Vigenère key contains ${length} letters.`,
};

const VIGENERE_KEY_LETTER_MESSAGES: Record<Language, (letter: string, shift: number) => string> = {
  uk: (letter, shift) => `Перша літера ключа — «${letter}» (зсув ${shift}).`,
  en: (letter, shift) => `The first key letter is "${letter}" (shift ${shift}).`,
};

const SUBSTITUTION_MESSAGES: Record<Language, (cipherLetter: string, plainLetter: string) => string> = {
  uk: (c, p) => `Літера «${c}» у шифротексті відповідає літері «${p}».`,
  en: (c, p) => `The letter "${c}" in the ciphertext corresponds to "${p}".`,
};

const CONTEXT_MESSAGES: Record<Language, (clue: string) => string> = {
  uk: (clue) => `Контекст завдання: ${clue}.`,
  en: (clue) => `Task context: ${clue}.`,
};

export interface HintInput {
  module: CipherModule;
  language: Language;
  ciphertext: string;
  cipherParams: Record<string, unknown>;
  /** 1-based tier, at most getMaxHints(difficulty). */
  tier: number;
  /** Player's current cipher→plain guesses (FREQUENCY module only). */
  substitution?: Record<string, string>;
}

function ciphertextCounts(ciphertext: string, alphabet: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of ciphertext) {
    if (alphabet.includes(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

/** CAESAR: generic statistics — the frequency hint is meaningful here. */
function buildCaesarHint(input: HintInput): string {
  const { language, ciphertext, cipherParams, tier } = input;
  const messages = CAESAR_MESSAGES[language];
  const alphabet = getAlphabet(language);

  if (tier === 1) {
    const counts = ciphertextCounts(ciphertext, alphabet);
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

  const plaintext = decryptCiphertext(ciphertext, 'CAESAR', cipherParams, language);
  const words = plaintext.split(' ');

  if (tier === 2) {
    return messages.firstLetter(plaintext[0] ?? '?');
  }
  return messages.firstWord(words[0] ?? '?');
}

/**
 * TRANSPOSITION (route cipher): the puzzle is the grid dimensions (the
 * divisor test) and the fill route. Tier 1 reveals the column count; tier 2
 * reveals the route name; tier 3 reveals the first plaintext word (taken
 * from `cipherParams.firstWord` — the stored ciphertext is a solid letter
 * stream with no word boundaries, so it cannot be split into words).
 */
function buildTranspositionHint(input: HintInput): string {
  const { language, cipherParams, tier } = input;
  const cols = Number(cipherParams.cols);

  if (tier === 1 || !Number.isInteger(cols) || cols <= 0) {
    return TRANSPOSITION_COLUMNS_MESSAGES[language](cols);
  }

  if (tier === 2) {
    const route = typeof cipherParams.route === 'string' ? (cipherParams.route as RouteKind) : null;
    // `?? '?'` guards legacy sessions whose stored route names no longer exist.
    const name = route ? (ROUTE_NAMES[language][route] ?? '?') : '?';
    return TRANSPOSITION_ROUTE_MESSAGES[language](name);
  }

  const storedFirstWord = typeof cipherParams.firstWord === 'string' ? cipherParams.firstWord.trim() : '';
  if (storedFirstWord) {
    return CAESAR_MESSAGES[language].firstWord(storedFirstWord);
  }
  // Legacy fallback for sessions created before the solid-stream change.
  const plaintext = decryptCiphertext(input.ciphertext, 'TRANSPOSITION', cipherParams, language);
  const words = plaintext.split(' ');
  return CAESAR_MESSAGES[language].firstWord(words[0] ?? '?');
}

/** Drop guess entries whose letters don't belong to the alphabet. */
function sanitizeSubstitution(
  substitution: Record<string, string> | undefined,
  alphabet: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [cipher, plain] of Object.entries(substitution ?? {})) {
    if (cipher.length === 1 && plain.length === 1 && alphabet.includes(cipher) && alphabet.includes(plain)) {
      out[cipher] = plain;
    }
  }
  return out;
}

/**
 * FREQUENCY: reveal one correct substitution per tier. Candidates are
 * ciphertext letters ordered by frequency (most valuable first); letters
 * the player currently maps incorrectly come before unmapped ones. The
 * tier index walks the candidate list, so repeated hints don't repeat
 * themselves while guesses stay unchanged.
 */
function buildFrequencyHint(input: HintInput): string {
  const { language, ciphertext, cipherParams, tier } = input;
  const alphabet = getAlphabet(language);
  const cipherAlphabet = typeof cipherParams.alphabet === 'string' ? cipherParams.alphabet : alphabet;

  const correct = new Map<string, string>();
  for (let i = 0; i < alphabet.length; i++) {
    correct.set(cipherAlphabet[i] ?? alphabet[i]!, alphabet[i]!);
  }

  const guesses = sanitizeSubstitution(input.substitution, alphabet);
  const counts = ciphertextCounts(ciphertext, alphabet);
  const byFrequency = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const wrong: string[] = [];
  const unmapped: string[] = [];
  for (const [letter] of byFrequency) {
    const guess = guesses[letter];
    if (guess === undefined) unmapped.push(letter);
    else if (guess !== correct.get(letter)) wrong.push(letter);
  }

  const candidates = [...wrong, ...unmapped];
  const letter = candidates.length > 0 ? candidates[(tier - 1) % candidates.length]! : byFrequency[0]![0];
  return SUBSTITUTION_MESSAGES[language](letter, correct.get(letter)!);
}

/** The thematic context clue (MEDIUM): metadata about the phrase's genre. */
export function buildContextHint(language: Language, clue: string): string {
  return CONTEXT_MESSAGES[language](clue);
}

/**
 * VIGENERE: the puzzle is the key — its length (found via Kasiski) and
 * then its letters (one Caesar slider each). Tier 1 reveals the key
 * length; tier 2 reveals the first key letter with its shift; tier 3
 * reveals the first plaintext word.
 */
function buildVigenereHint(input: HintInput): string {
  const { language, cipherParams, tier } = input;
  const key = typeof cipherParams.key === 'string' ? cipherParams.key : '';

  if (tier === 1 || key.length === 0) {
    return VIGENERE_KEY_LENGTH_MESSAGES[language](key.length);
  }

  if (tier === 2) {
    const alphabet = getAlphabet(language);
    const shift = alphabet.indexOf(key[0]!);
    return VIGENERE_KEY_LETTER_MESSAGES[language](key[0]!, shift);
  }

  const plaintext = decryptCiphertext(input.ciphertext, 'VIGENERE', cipherParams, language);
  const words = plaintext.split(' ');
  return CAESAR_MESSAGES[language].firstWord(words[0] ?? '?');
}

/** Fully isolated dispatch: each module gets only its own hint logic. */
export function buildHint(input: HintInput): string {
  switch (input.module) {
    case 'CAESAR':
      return buildCaesarHint(input);
    case 'TRANSPOSITION':
      return buildTranspositionHint(input);
    case 'FREQUENCY':
      return buildFrequencyHint(input);
    case 'VIGENERE':
      return buildVigenereHint(input);
  }
}
