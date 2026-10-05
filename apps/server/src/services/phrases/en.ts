import type { CorpusPhrase } from './corpus.js';

/**
 * English corpus (Phase 6): phrase lengths are tied to difficulty so the
 * letter statistics behave like real cryptanalysis material —
 * EASY: long texts (>100 chars, clean statistics),
 * MEDIUM: short texts (40–60 chars, noisy statistics),
 * HARD: very short texts (20–30 chars, solid letter stream after prep).
 */
export const phrases: CorpusPhrase[] = [
  {
    difficulty: 'EASY',
    text: 'attention all units the assault begins at dawn this secret order is delivered only to section commanders discussing operation details is strictly forbidden',
    context: 'Military order',
  },
  {
    difficulty: 'EASY',
    text: 'reconnaissance reports the enemy has concentrated forces near the river the bridges are guarded day and night send reinforcements no later than midnight',
    context: 'Intelligence report',
  },
  {
    difficulty: 'EASY',
    text: 'he who owns information owns the world but a true analyst can read between the lines and see patterns where others see chaos',
    context: 'Folk wisdom',
  },
  {
    difficulty: 'EASY',
    text: 'every letter in this message has its own weight and place if you count carefully and compare you can restore the original text without any key',
    context: 'Cryptography training course',
  },
  {
    difficulty: 'EASY',
    text: 'ancient generals encrypted their orders with a simple shift of the alphabet hoping the enemy would never guess how to read the intercepted letter',
    context: 'Historical note',
  },
  {
    difficulty: 'EASY',
    text: 'the quiet hunt begins at midnight the signal for the attack is three short flashes of the lantern after that the bridge must fall before sunrise',
    context: 'Military order',
  },
  {
    difficulty: 'MEDIUM',
    text: 'the agent sends a report on troop movements',
    context: 'Intelligence report',
  },
  {
    difficulty: 'MEDIUM',
    text: 'the cipher hides its secret inside the pattern of letters',
    context: 'Cryptography training course',
  },
  {
    difficulty: 'MEDIUM',
    text: 'frequency analysis reveals the habits of the language',
    context: 'Cryptography training course',
  },
  {
    difficulty: 'MEDIUM',
    text: 'letters trade places but the meaning stays the same',
    context: 'Cryptography training course',
  },
  {
    difficulty: 'MEDIUM',
    text: 'the order was sent at midnight by coded signal',
    context: 'Military order',
  },
  {
    difficulty: 'MEDIUM',
    text: 'the key to the cipher is hidden in an old book',
    context: 'Historical note',
  },
  {
    difficulty: 'MEDIUM',
    text: 'shift the alphabet and the hidden message appears',
    context: 'Cryptography training course',
  },
  {
    difficulty: 'MEDIUM',
    text: 'a good cryptanalyst never guesses but measures',
    context: 'Cryptography training course',
  },
  {
    difficulty: 'HARD',
    text: 'attack at dawn tomorrow',
    context: 'Military order',
  },
  {
    difficulty: 'HARD',
    text: 'change position at midnight',
    context: 'Military order',
  },
  {
    difficulty: 'HARD',
    text: 'hold the bridge until relief',
    context: 'Military order',
  },
  {
    difficulty: 'HARD',
    text: 'the agent is silent two days',
    context: 'Intelligence report',
  },
  {
    difficulty: 'HARD',
    text: 'the key is in the old library',
    context: 'Historical note',
  },
  {
    difficulty: 'HARD',
    text: 'flank them from the east',
    context: 'Military order',
  },
  {
    difficulty: 'HARD',
    text: 'bridge falls before sunrise',
    context: 'Military order',
  },
];
