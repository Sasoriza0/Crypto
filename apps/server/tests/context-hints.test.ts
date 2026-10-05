import { describe, expect, it } from 'vitest';
import { buildContextHint } from '../src/services/hints.service.js';

/**
 * The MEDIUM context hint wraps the stored thematic clue (metadata about
 * the phrase's genre) into a localized hint string. It never contains
 * plaintext content.
 */
describe('buildContextHint', () => {
  it('wraps the clue for Ukrainian sessions', () => {
    expect(buildContextHint('uk', 'Військовий наказ')).toBe('Контекст завдання: Військовий наказ.');
  });

  it('wraps the clue for English sessions', () => {
    expect(buildContextHint('en', 'Military order')).toBe('Task context: Military order.');
  });
});
