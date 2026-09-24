import type { Difficulty } from '@shiftcrack/shared';
import { randomIntInRange } from '../../lib/text.js';

/**
 * Columnar transposition cipher. The key is a permutation of column
 * indices (read order). Difficulty ranges per SDD §4: key length
 * EASY 4–5, MEDIUM 6–7, HARD 8–9.
 */

export interface KeyLengthRange {
  min: number;
  max: number;
}

export function getTranspositionKeyLengthRange(difficulty: Difficulty): KeyLengthRange {
  switch (difficulty) {
    case 'EASY':
      return { min: 4, max: 5 };
    case 'MEDIUM':
      return { min: 6, max: 7 };
    case 'HARD':
      return { min: 8, max: 9 };
    default:
      throw new Error(`Unknown difficulty: ${String(difficulty)}`);
  }
}

export function generateTranspositionKey(difficulty: Difficulty): number[] {
  const { min, max } = getTranspositionKeyLengthRange(difficulty);
  const length = randomIntInRange(min, max);
  const key = Array.from({ length }, (_, i) => i);
  // Fisher–Yates shuffle with crypto randomness
  for (let i = length - 1; i > 0; i--) {
    const j = randomIntInRange(0, i);
    [key[i], key[j]] = [key[j]!, key[i]!];
  }
  return key;
}

/** Fill row-major, read columns in the order given by the key. */
export function transpositionEncrypt(text: string, key: number[]): string {
  const cols = key.length;
  const rows = Math.ceil(text.length / cols);
  const out: string[] = [];
  for (let c = 0; c < cols; c++) {
    const col = key[c]!;
    for (let r = 0; r < rows; r++) {
      const idx = r * cols + col;
      if (idx < text.length) out.push(text[idx]!);
    }
  }
  return out.join('');
}

export function transpositionDecrypt(ciphertext: string, key: number[]): string {
  const cols = key.length;
  const rows = Math.ceil(ciphertext.length / cols);
  const fullCols = ciphertext.length % cols === 0 ? cols : ciphertext.length % cols;

  // Slice ciphertext back into per-column strings in key (read) order.
  // Actual column indices >= fullCols hold rows-1 characters.
  const columns: string[] = new Array(cols);
  let pos = 0;
  for (let c = 0; c < cols; c++) {
    const actual = key[c]!;
    const len = actual < fullCols ? rows : rows - 1;
    columns[actual] = ciphertext.slice(pos, pos + len);
    pos += len;
  }

  // Reassemble row-major.
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let actual = 0; actual < cols; actual++) {
      const col = columns[actual]!;
      if (r < col.length) out.push(col[r]!);
    }
  }
  return out.join('');
}
