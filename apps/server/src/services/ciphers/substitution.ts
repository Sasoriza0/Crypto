import { randomIntInRange } from '../../lib/text.js';

/**
 * Monoalphabetic substitution cipher for the FREQUENCY module:
 * the alphabet is mapped to a random permutation of itself.
 */

export type SubstitutionDirection = 'encrypt' | 'decrypt';

/** Random permutation of the alphabet (cipher alphabet). */
export function generateSubstitution(alphabet: string): string {
  const chars = alphabet.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIntInRange(0, i);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

export function substitute(
  text: string,
  plainAlphabet: string,
  cipherAlphabet: string,
  direction: SubstitutionDirection,
): string {
  const from = direction === 'encrypt' ? plainAlphabet : cipherAlphabet;
  const to = direction === 'encrypt' ? cipherAlphabet : plainAlphabet;
  const map = new Map<string, string>();
  for (let i = 0; i < from.length; i++) {
    map.set(from[i]!, to[i]!);
  }
  return text
    .split('')
    .map((ch) => map.get(ch) ?? ch)
    .join('');
}
