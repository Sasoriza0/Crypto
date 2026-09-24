import type { Language } from '@shiftcrack/shared';

/**
 * Static letter-frequency tables per language (approximate literary
 * frequencies, values sum to ~1). Used for hints and module metadata —
 * the FREQUENCY module's UI relies on these for analysis guidance.
 */

export const EN_FREQUENCIES: Record<string, number> = {
  a: 0.082, b: 0.015, c: 0.028, d: 0.043, e: 0.127, f: 0.022, g: 0.02, h: 0.061, i: 0.07, j: 0.0015, k: 0.008, l: 0.04,
  m: 0.024, n: 0.067, o: 0.075, p: 0.019, q: 0.001, r: 0.06, s: 0.063, t: 0.091, u: 0.028, v: 0.01, w: 0.024, x: 0.0015,
  y: 0.02, z: 0.0007,
};

export const UK_FREQUENCIES: Record<string, number> = {
  а: 0.072, б: 0.016, в: 0.045, г: 0.017, ґ: 0.002, д: 0.033, е: 0.042, є: 0.009, ж: 0.009, з: 0.023, и: 0.061, і: 0.057,
  ї: 0.006, й: 0.009, к: 0.035, л: 0.036, м: 0.031, н: 0.065, о: 0.094, п: 0.029, р: 0.047, с: 0.041, т: 0.055, у: 0.04,
  ф: 0.003, х: 0.012, ц: 0.006, ч: 0.014, ш: 0.006, щ: 0.003, ь: 0.029, ю: 0.007, я: 0.023,
};

export function getFrequencyTable(language: Language): Record<string, number> {
  return language === 'uk' ? UK_FREQUENCIES : EN_FREQUENCIES;
}
