import type { Difficulty } from '@shiftcrack/shared';

/**
 * A corpus phrase plus its thematic context. The context is metadata ABOUT
 * the text (its "genre" — e.g. a military order), never part of the
 * plaintext, so it can be stored on the session row and revealed as a hint
 * without leaking the answer.
 */
export interface CorpusPhrase {
  difficulty: Difficulty;
  text: string;
  context: string;
}
