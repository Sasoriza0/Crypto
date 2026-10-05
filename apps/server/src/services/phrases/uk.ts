import type { CorpusPhrase } from './corpus.js';

/**
 * Ukrainian corpus (Phase 6): phrase lengths are tied to difficulty so the
 * letter statistics behave like real cryptanalysis material —
 * EASY: long texts (>100 chars, clean statistics),
 * MEDIUM: short texts (40–60 chars, noisy statistics),
 * HARD: very short texts (20–30 chars, solid letter stream after prep).
 */
export const phrases: CorpusPhrase[] = [
  {
    difficulty: 'EASY',
    text: 'увага всім підрозділам наступ починається на світанку наказ передається лише командирам відділень деталі операції обговорювати заборонено',
    context: 'Військовий наказ',
  },
  {
    difficulty: 'EASY',
    text: 'розвідка доповідає противник зосередив великі сили біля річки мости охороняються вдень і вночі надішліть підкріплення до опівночі',
    context: 'Доповідь розвідки',
  },
  {
    difficulty: 'EASY',
    text: 'хто володіє інформацією той володіє світом але справжній аналітик вміє читати між рядками і бачити закономірності там де інші бачать хаос',
    context: 'Народна мудрість',
  },
  {
    difficulty: 'EASY',
    text: 'кожна літера повідомлення має свою вагу і місце якщо уважно рахувати та порівнювати можна відновити початковий текст без жодного ключа',
    context: 'Навчальний курс криптографії',
  },
  {
    difficulty: 'EASY',
    text: 'давні полководці шифрували свої накази простим зсувом алфавіту і вірили що ворог ніколи не прочитає перехопленого листа',
    context: 'Історична замітка',
  },
  {
    difficulty: 'EASY',
    text: 'тихе полювання починається опівночі сигнал до атаки три короткі спалахи ліхтаря після цього міст має бути знищено до світанку',
    context: 'Військовий наказ',
  },
  {
    difficulty: 'MEDIUM',
    text: 'агент надсилає звіт про переміщення військ',
    context: 'Доповідь розвідки',
  },
  {
    difficulty: 'MEDIUM',
    text: 'цей шифр ховає таємницю у візерунку літер',
    context: 'Навчальний курс криптографії',
  },
  {
    difficulty: 'MEDIUM',
    text: 'частотний аналіз завжди викриває звички мови',
    context: 'Навчальний курс криптографії',
  },
  {
    difficulty: 'MEDIUM',
    text: 'літери міняються місцями а зміст лишається',
    context: 'Навчальний курс криптографії',
  },
  {
    difficulty: 'MEDIUM',
    text: 'наказ передано опівночі кодованим сигналом',
    context: 'Військовий наказ',
  },
  {
    difficulty: 'MEDIUM',
    text: 'справжній ключ до шифру заховано у старій книзі',
    context: 'Історична замітка',
  },
  {
    difficulty: 'MEDIUM',
    text: 'зсув алфавіту відкриває приховане повідомлення',
    context: 'Навчальний курс криптографії',
  },
  {
    difficulty: 'MEDIUM',
    text: 'добрий криптоаналітик не вгадує а вимірює',
    context: 'Навчальний курс криптографії',
  },
  {
    difficulty: 'HARD',
    text: 'наказ наступ на світанку',
    context: 'Військовий наказ',
  },
  {
    difficulty: 'HARD',
    text: 'змінити позицію опівночі',
    context: 'Військовий наказ',
  },
  {
    difficulty: 'HARD',
    text: 'тримайте міст до підкріплення',
    context: 'Військовий наказ',
  },
  {
    difficulty: 'HARD',
    text: 'агент мовчить два дні',
    context: 'Доповідь розвідки',
  },
  {
    difficulty: 'HARD',
    text: 'ключ у старій бібліотеці',
    context: 'Історична замітка',
  },
  {
    difficulty: 'HARD',
    text: 'обхід зі сходу завтра',
    context: 'Військовий наказ',
  },
  {
    difficulty: 'HARD',
    text: 'міст впаде до світанку',
    context: 'Військовий наказ',
  },
];
