import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { Language } from '@shiftcrack/shared';

/**
 * Plain-text utilities shared by cipher services and the game service.
 *
 * Normalization is intentionally server-side only (SDD §5): the API accepts
 * the raw answer and the server folds case / strips non-alphabet characters
 * right before hashing, so the client cannot probe the comparison algorithm.
 */

export const EN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
export const UK_ALPHABET = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';

export function getAlphabet(language: Language): string {
  return language === 'uk' ? UK_ALPHABET : EN_ALPHABET;
}

/** Lowercase and keep only letters that belong to the given alphabet. */
export function normalizeText(input: string, alphabet: string): string {
  const allowed = new Set(alphabet.toLowerCase().split(''));
  return input
    .toLowerCase()
    .split('')
    .filter((ch) => allowed.has(ch))
    .join('');
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Constant-time comparison for two lowercase hex digests of equal length
 * (both sides are always sha256 hex, i.e. 64 chars). Throws on length
 * mismatch rather than comparing unsafely.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** Crypto-secure random integer in [min, max] (inclusive). */
export function randomIntInRange(min: number, max: number): number {
  return randomInt(min, max + 1);
}
