import { describe, expect, it } from 'vitest';
import { EN_ALPHABET, UK_ALPHABET } from '../src/lib/text.js';
import { caesarDecrypt, caesarEncrypt, getCaesarShiftRange } from '../src/services/ciphers/caesar.js';
import { generateSubstitution, substitute } from '../src/services/ciphers/substitution.js';
import {
  ROUTES,
  generateRouteParams,
  getRouteParamsRange,
  routeCellOrder,
  routeDecrypt,
  routeEncrypt,
} from '../src/services/ciphers/transposition.js';

describe('caesar cipher', () => {
  it('round-trips on the English alphabet for every shift', () => {
    const text = 'attackatdawn';
    for (let shift = 1; shift < EN_ALPHABET.length; shift++) {
      expect(caesarDecrypt(caesarEncrypt(text, shift, EN_ALPHABET), shift, EN_ALPHABET)).toBe(text);
    }
  });

  it('round-trips on the Ukrainian alphabet', () => {
    const text = 'славаукраїні';
    const encrypted = caesarEncrypt(text, 7, UK_ALPHABET);
    expect(caesarDecrypt(encrypted, 7, UK_ALPHABET)).toBe(text);
  });

  it('keeps non-alphabet characters untouched', () => {
    expect(caesarEncrypt('a-b c', 1, EN_ALPHABET)).toBe('b-c d');
  });

  it('uses the difficulty ranges defined in SDD §4', () => {
    expect(getCaesarShiftRange('EASY', 33)).toEqual({ min: 1, max: 3 });
    expect(getCaesarShiftRange('MEDIUM', 33)).toEqual({ min: 4, max: 15 });
    expect(getCaesarShiftRange('HARD', 33)).toEqual({ min: 1, max: 32 });
  });
});

describe('route cipher', () => {
  const routes = [ROUTES.HORIZONTAL_SNAKE, ROUTES.VERTICAL_SNAKE, ROUTES.SPIRAL_CW, ROUTES.SPIRAL_CCW];

  it('round-trips for every route when the text length is a multiple of the column count', () => {
    const text = 'abcdefghijkl';
    for (const route of routes) {
      for (const cols of [3, 4, 5]) {
        expect(routeDecrypt(routeEncrypt(text, cols, route, 'z'), cols, route, text.length)).toBe(text);
      }
    }
  });

  it('round-trips when the last row is incomplete (letter padding)', () => {
    const text = 'thequickbrownfox';
    for (const route of routes) {
      for (const cols of [3, 4, 5, 7]) {
        expect(routeDecrypt(routeEncrypt(text, cols, route, 'z'), cols, route, text.length)).toBe(text);
      }
    }
  });

  it('produces a solid letter stream without any padding symbols', () => {
    const ciphertext = routeEncrypt('thequickbrownfox', 4, ROUTES.HORIZONTAL_SNAKE, 'z');
    expect(ciphertext).not.toMatch(/\s/);
    expect([...ciphertext].every((ch) => ch >= 'a' && ch <= 'z')).toBe(true);
  });

  it('always yields a rectangular grid: ciphertext length is a multiple of the column count', () => {
    for (const cols of [3, 4, 5, 6, 7]) {
      const ciphertext = routeEncrypt('thequickbrownfox', cols, ROUTES.SPIRAL_CW, 'z');
      expect(ciphertext.length % cols).toBe(0);
    }
  });

  it('keeps word structure for texts that contain spaces', () => {
    const text = 'attack at dawn';
    const ciphertext = routeEncrypt(text, 4, ROUTES.VERTICAL_SNAKE, 'z');
    expect(routeDecrypt(ciphertext, 4, ROUTES.VERTICAL_SNAKE, text.length)).toBe(text);
  });

  it('actually permutes the text', () => {
    // 3 cols × 2 rows, HORIZONTAL_SNAKE reads rows 0 and 1 in opposite directions
    expect(routeEncrypt('abcdef', 3, ROUTES.HORIZONTAL_SNAKE, 'x')).toBe('abcfed');
  });

  it('generates route params within the SDD difficulty ranges', () => {
    for (let i = 0; i < 50; i++) {
      const easy = generateRouteParams('EASY');
      expect(easy.cols).toBeGreaterThanOrEqual(3);
      expect(easy.cols).toBeLessThanOrEqual(4);
      expect(getRouteParamsRange('EASY').routes).toContain(easy.route);

      const medium = generateRouteParams('MEDIUM');
      expect(medium.cols).toBeGreaterThanOrEqual(4);
      expect(medium.cols).toBeLessThanOrEqual(5);
      expect(getRouteParamsRange('MEDIUM').routes).toContain(medium.route);

      const hard = generateRouteParams('HARD');
      expect(hard.cols).toBeGreaterThanOrEqual(5);
      expect(hard.cols).toBeLessThanOrEqual(7);
      expect(getRouteParamsRange('HARD').routes).toContain(hard.route);
    }
  });

  it('limits route variety per difficulty (continuous routes only)', () => {
    expect(getRouteParamsRange('EASY').routes).toEqual([ROUTES.HORIZONTAL_SNAKE, ROUTES.VERTICAL_SNAKE]);
    expect(getRouteParamsRange('MEDIUM').routes).toEqual([
      ROUTES.HORIZONTAL_SNAKE,
      ROUTES.VERTICAL_SNAKE,
      ROUTES.SPIRAL_CW,
    ]);
    expect(getRouteParamsRange('HARD').routes).toEqual([
      ROUTES.HORIZONTAL_SNAKE,
      ROUTES.VERTICAL_SNAKE,
      ROUTES.SPIRAL_CW,
      ROUTES.SPIRAL_CCW,
    ]);
  });
});

describe('routeCellOrder', () => {
  it('reads boustrophedon rows for HORIZONTAL_SNAKE', () => {
    expect(routeCellOrder(ROUTES.HORIZONTAL_SNAKE, 3, 2)).toEqual([0, 1, 2, 5, 4, 3]);
  });

  it('reads down/up/down columns for VERTICAL_SNAKE', () => {
    expect(routeCellOrder(ROUTES.VERTICAL_SNAKE, 3, 2)).toEqual([0, 3, 4, 1, 2, 5]);
  });

  it('reads a clockwise spiral', () => {
    expect(routeCellOrder(ROUTES.SPIRAL_CW, 3, 3)).toEqual([0, 1, 2, 5, 8, 7, 6, 3, 4]);
  });

  it('reads a counterclockwise spiral', () => {
    expect(routeCellOrder(ROUTES.SPIRAL_CCW, 3, 3)).toEqual([0, 3, 6, 7, 8, 5, 2, 1, 4]);
  });

  it('covers every cell exactly once for odd shapes', () => {
    for (const route of [
      ROUTES.HORIZONTAL_SNAKE,
      ROUTES.VERTICAL_SNAKE,
      ROUTES.SPIRAL_CW,
      ROUTES.SPIRAL_CCW,
    ]) {
      for (const [cols, rows] of [
        [2, 5],
        [5, 2],
        [4, 4],
        [7, 3],
      ]) {
        const order = routeCellOrder(route, cols, rows);
        expect(order).toHaveLength(cols * rows);
        expect(new Set(order).size).toBe(cols * rows);
      }
    }
  });

  it('every route is a continuous path: consecutive cells share an edge', () => {
    const isAdjacent = (a: number, b: number, cols: number): boolean => {
      const ar = Math.floor(a / cols);
      const ac = a % cols;
      const br = Math.floor(b / cols);
      const bc = b % cols;
      return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
    };
    for (const route of [
      ROUTES.HORIZONTAL_SNAKE,
      ROUTES.VERTICAL_SNAKE,
      ROUTES.SPIRAL_CW,
      ROUTES.SPIRAL_CCW,
    ]) {
      for (const [cols, rows] of [
        [2, 5],
        [5, 2],
        [3, 3],
        [4, 4],
        [7, 3],
        [3, 7],
        [6, 5],
      ]) {
        const order = routeCellOrder(route, cols, rows);
        expect(order).toHaveLength(cols * rows);
        for (let i = 1; i < order.length; i++) {
          expect(isAdjacent(order[i - 1]!, order[i]!, cols)).toBe(true);
        }
      }
    }
  });
});

describe('substitution cipher', () => {
  it('round-trips encrypt then decrypt', () => {
    const cipherAlphabet = generateSubstitution(EN_ALPHABET);
    const text = 'frequencyanalysis';
    const encrypted = substitute(text, EN_ALPHABET, cipherAlphabet, 'encrypt');
    expect(substitute(encrypted, EN_ALPHABET, cipherAlphabet, 'decrypt')).toBe(text);
  });

  it('produces a permutation of the alphabet', () => {
    const cipherAlphabet = generateSubstitution(UK_ALPHABET);
    expect([...cipherAlphabet].sort().join('')).toBe([...UK_ALPHABET].sort().join(''));
  });
});
