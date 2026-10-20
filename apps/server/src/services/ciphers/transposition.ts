import { randomIntInRange } from '../../lib/text.js';

/**
 * Route cipher (Phase 6): the plaintext is written into a cols×rows table
 * following a classic ROUTE and read row-major. The ciphertext is always
 * a solid rectangular letter stream of `rows × cols` cells, so the correct
 * column count is one of the divisors of the ciphertext length — exactly
 * the divisor test real route-cipher cryptanalysis starts with.
 *
 * Grid generation is INVERTED: the dimensions come first (random 3–7
 * columns × random 3–7 rows), then the text is fit to the cols×rows grid
 * (truncated or padded with traditional dummy letters — see the phrase
 * service). `cipherParams.length` keeps the REAL content length so
 * decryption can cut the dummies off exactly.
 *
 * Every route is a CONTINUOUS path: consecutive cells always share an
 * edge, so the player can trace the whole route in one uninterrupted drag
 * (jumpy routes like plain column-by-column reading are not offered).
 */

export const ROUTES = {
  /** Rows read left→right, right→left, left→right… (boustrophedon). */
  HORIZONTAL_SNAKE: 'HORIZONTAL_SNAKE',
  /** Columns read down, up, down… — the vertical counterpart. */
  VERTICAL_SNAKE: 'VERTICAL_SNAKE',
  SPIRAL_CW: 'SPIRAL_CW',
  SPIRAL_CCW: 'SPIRAL_CCW',
} as const;
export type RouteKind = (typeof ROUTES)[keyof typeof ROUTES];

export interface RouteParams {
  route: RouteKind;
  cols: number;
  rows: number;
}

/** Both grid dimensions roll independently in 3–7 — any rectangle works. */
const GRID_DIM_MIN = 3;
const GRID_DIM_MAX = 7;

/**
 * Legacy difficulty tiers are gone (story-fixed missions): the fill route
 * is drawn from ONE fixed balanced pool — the two snakes plus the
 * clockwise spiral. Counterclockwise spirals remain supported for
 * decryption of legacy sessions, but are no longer generated.
 */
const GENERATED_ROUTES: readonly RouteKind[] = [
  ROUTES.HORIZONTAL_SNAKE,
  ROUTES.VERTICAL_SNAKE,
  ROUTES.SPIRAL_CW,
];

export function generateRouteParams(): RouteParams {
  return {
    cols: randomIntInRange(GRID_DIM_MIN, GRID_DIM_MAX),
    rows: randomIntInRange(GRID_DIM_MIN, GRID_DIM_MAX),
    route: GENERATED_ROUTES[randomIntInRange(0, GENERATED_ROUTES.length - 1)]!,
  };
}

/** Cell indices (row×cols + col) in reading order for a route in a grid. */
export function routeCellOrder(route: RouteKind, cols: number, rows: number): number[] {
  const order: number[] = [];
  switch (route) {
    case ROUTES.HORIZONTAL_SNAKE:
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) order.push(r * cols + (r % 2 === 0 ? c : cols - 1 - c));
      }
      break;
    case ROUTES.VERTICAL_SNAKE:
      // Column 0 top→bottom, column 1 bottom→top, column 2 top→bottom…
      // each column ends exactly where the next one starts — no jumps.
      for (let c = 0; c < cols; c++) {
        if (c % 2 === 0) {
          for (let r = 0; r < rows; r++) order.push(r * cols + c);
        } else {
          for (let r = rows - 1; r >= 0; r--) order.push(r * cols + c);
        }
      }
      break;
    case ROUTES.SPIRAL_CW:
    case ROUTES.SPIRAL_CCW:
      spiralOrder(route, cols, rows, order);
      break;
  }
  return order;
}

function spiralOrder(route: RouteKind, cols: number, rows: number, order: number[]): void {
  const clockwise = route === ROUTES.SPIRAL_CW;
  const total = cols * rows;
  const push = (r: number, c: number) => {
    if (order.length < total) order.push(r * cols + c);
  };
  let top = 0;
  let bottom = rows - 1;
  let left = 0;
  let right = cols - 1;
  while (top <= bottom && left <= right && order.length < total) {
    if (clockwise) {
      for (let c = left; c <= right; c++) push(top, c);
      top++;
      for (let r = top; r <= bottom; r++) push(r, right);
      right--;
      if (top <= bottom) {
        for (let c = right; c >= left; c--) push(bottom, c);
        bottom--;
      }
      if (left <= right) {
        for (let r = bottom; r >= top; r--) push(r, left);
        left++;
      }
    } else {
      for (let r = top; r <= bottom; r++) push(r, left);
      left++;
      for (let c = left; c <= right; c++) push(bottom, c);
      bottom--;
      if (left <= right) {
        for (let r = bottom; r >= top; r--) push(r, right);
        right--;
      }
      if (top <= bottom) {
        for (let c = right; c >= left; c--) push(top, c);
        top++;
      }
    }
  }
}

/** Fill the grid along the route (letter-padded), read it row-major. */
export function routeEncrypt(text: string, cols: number, route: RouteKind, filler: string): string {
  const rows = Math.ceil(text.length / cols);
  const cells: string[] = new Array<string>(rows * cols).fill(filler);
  const order = routeCellOrder(route, cols, rows);
  for (let i = 0; i < text.length; i++) {
    cells[order[i]!] = text[i]!;
  }
  return cells.join('');
}

/**
 * Reverse of encrypt: read the ciphertext row-major into the grid, then
 * extract cells along the route. `originalLength` cuts the filler off;
 * defaults to the full ciphertext length for callers that don't track it.
 */
export function routeDecrypt(
  ciphertext: string,
  cols: number,
  route: RouteKind,
  originalLength = ciphertext.length,
): string {
  const rows = Math.ceil(ciphertext.length / cols);
  const order = routeCellOrder(route, cols, rows);
  const out = order.map((cell) => ciphertext[cell] ?? '');
  return out.join('').slice(0, originalLength);
}
