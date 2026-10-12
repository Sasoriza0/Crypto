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
  {
    difficulty: 'EASY',
    text: 'the meeting is set for seven in the evening near the old station the password changes every day and your call sign will be spoken three times after the check you must hand the package to the courier in the green hat',
    context: 'Agent radio message',
  },
  {
    difficulty: 'EASY',
    text: 'the observation post recorded a column of armoured vehicles moving north the highway is blocked by two checkpoints and armed guards patrol near the depot at night an ammunition train arrives to be met by two officers in plain clothes',
    context: 'Intelligence report',
  },
  {
    difficulty: 'EASY',
    text: 'the diplomatic courier left the capital on the morning train the briefcase is chained to his wrist and only the resident knows the lock code headquarters awaits confirmation no later than midnight otherwise the operation will be cancelled',
    context: 'Coded dispatch',
  },
  {
    difficulty: 'EASY',
    text: 'the third company takes the hill before dark the second company covers the crossing the artillery stays silent until the signal no green flares company commanders report every half hour with a two word code',
    context: 'Military order',
  },
  {
    difficulty: 'EASY',
    text: 'in the middle ages only monks and royal secretaries were trusted with ciphers simple shifts of the alphabet seemed a marvel to spies of neighbouring courts and intercepted letters were read by candlelight all night long',
    context: 'Historical note',
  },
  {
    difficulty: 'EASY',
    text: 'the printing press works in a cellar under the butcher shop the copies are hidden in sacks of flour and the leaflets go out at dawn on bicycles informers stand on every corner so all passwords change at midnight',
    context: 'Underground message',
  },
  {
    difficulty: 'EASY',
    text: 'the enemy radio station broadcasts from the forest on frequency forty two they encrypt orders with a simple shift and repeat the key every three days intercepted sessions are recorded on tape and sent to headquarters each evening',
    context: 'Intelligence report',
  },
  {
    difficulty: 'EASY',
    text: 'a secret lives exactly as long as two people keep silent but a good cipher holds even when the letter falls into enemy hands so choose your words carefully and keep the key in your head instead of paper',
    context: 'Folk wisdom',
  },
  {
    difficulty: 'EASY',
    text: 'the reconnaissance team departs tomorrow at ten in the evening the route is marked in chalk on the fence posts each kilometre allows three minutes of rest when meeting a patrol answer quietly and without panic the password is unchanged since saturday',
    context: 'Military order',
  },
  {
    difficulty: 'EASY',
    text: 'the first ciphers appeared long before the age of machines emperors and generals used transpositions and shifts while riders carried letters with secret orders in sealed leather bags losing such a letter could cost an entire campaign',
    context: 'Historical note',
  },
];
