import { describe, expect, it } from 'vitest';
import { buildHint } from '../src/services/hints.service.js';
import { getAlphabet } from '../src/lib/text.js';
import { ROUTES, routeDecrypt, routeEncrypt } from '../src/services/ciphers/transposition.js';

/**
 * TRANSPOSITION (route cipher) hints: tier 1 reveals the column count (the
 * divisor test), tier 2 reveals the fill route, tier 3 reveals the first
 * plaintext word.
 */

const COLS = 4;
const FILLER = getAlphabet('uk').slice(-1);

function transpositionHint(tier: number, language: 'uk' | 'en' = 'uk', route = ROUTES.HORIZONTAL_SNAKE): string {
  return buildHint({
    module: 'TRANSPOSITION',
    language,
    ciphertext: routeEncrypt('тихо їдеш далі будеш', COLS, route, FILLER),
    cipherParams: { route, cols: COLS, length: 'тихо їдеш далі будеш'.length },
    tier,
  });
}

describe('buildHint — TRANSPOSITION module (route cipher)', () => {
  it('tier 1 reveals the correct column count', () => {
    expect(transpositionHint(1)).toBe('Правильна кількість колонок: 4.');
  });

  it('tier 2 reveals the fill route', () => {
    expect(transpositionHint(2)).toBe('Таблицю було заповнено маршрутом: «горизонтальна змійка».');
  });

  it('tier 2 names each route for English sessions', () => {
    expect(transpositionHint(2, 'en', ROUTES.VERTICAL_SNAKE)).toBe(
      'The table was filled along the route: "vertical snake".',
    );
    expect(transpositionHint(2, 'en', ROUTES.SPIRAL_CW)).toBe(
      'The table was filled along the route: "clockwise spiral".',
    );
    expect(transpositionHint(2, 'en', ROUTES.SPIRAL_CCW)).toBe(
      'The table was filled along the route: "counterclockwise spiral".',
    );
  });

  it('tier 3 reveals the first plaintext word', () => {
    expect(transpositionHint(3)).toBe('Перше слово відкритого тексту: «тихо».');
  });

  it('tier 3 uses the stored first word for solid letter streams', () => {
    const text = 'тихоїдешдалібудеш';
    expect(
      buildHint({
        module: 'TRANSPOSITION',
        language: 'uk',
        ciphertext: routeEncrypt(text, COLS, ROUTES.HORIZONTAL_SNAKE, FILLER),
        cipherParams: { route: ROUTES.HORIZONTAL_SNAKE, cols: COLS, length: text.length, firstWord: 'тихо' },
        tier: 3,
      }),
    ).toBe('Перше слово відкритого тексту: «тихо».');
  });

  it('produces English messages', () => {
    expect(transpositionHint(1, 'en')).toBe('The correct number of columns is 4.');
    expect(transpositionHint(3, 'en')).toBe('The first word of the plaintext is: "тихо".');
  });

  it('caps higher tiers at the first-word hint (like CAESAR)', () => {
    expect(transpositionHint(9)).toBe('Перше слово відкритого тексту: «тихо».');
  });
});

describe('route cipher — rectangular letter-padded scheme', () => {
  it('encrypts to a rectangular grid: ciphertext length is rows × cols', () => {
    const ciphertext = routeEncrypt('slavaukraini', COLS, ROUTES.SPIRAL_CW, FILLER); // 12 chars, 4 cols → 3 rows
    expect(ciphertext).toHaveLength(12);
    expect(ciphertext.length % COLS).toBe(0);
  });

  it('keeps the ciphertext a solid letter stream for solid plaintext', () => {
    const ciphertext = routeEncrypt('slavaukraini', COLS, ROUTES.HORIZONTAL_SNAKE, FILLER);
    expect(ciphertext).not.toMatch(/\s/);
  });

  it('round-trips with every route and non-multiple lengths', () => {
    for (const route of [
      ROUTES.HORIZONTAL_SNAKE,
      ROUTES.VERTICAL_SNAKE,
      ROUTES.SPIRAL_CW,
      ROUTES.SPIRAL_CCW,
    ]) {
      for (const cols of [3, 4, 5, 6, 7]) {
        const text = 'thequickbrownfox';
        const ciphertext = routeEncrypt(text, cols, route, FILLER);
        expect(routeDecrypt(ciphertext, cols, route, text.length)).toBe(text);
      }
    }
  });
});
