import { CipherModule, type Difficulty } from '@shiftcrack/shared';

/**
 * Mission roster (Retro Spy Dossier step): the old per-module difficulty
 * picker is gone — each module IS a difficulty level.
 *   Mission 01 (EASY)   = Caesar Cipher
 *   Mission 02 (MEDIUM) = Route Transposition
 *   Mission 03 (HARD)   = Frequency Analysis
 *   Mission 04 (HARD)   = Vigenère Cipher (Kasiski)
 *   Mission 05 (HARD)   = Chimera Protocol (MitM → AES-ECB → JWT forge)
 */
export interface MissionDef {
  slug: string;
  module: CipherModule;
  difficulty: Difficulty;
  number: string;
}

export const MISSIONS: MissionDef[] = [
  { slug: 'caesar', module: CipherModule.CAESAR, difficulty: 'EASY', number: '01' },
  { slug: 'transposition', module: CipherModule.TRANSPOSITION, difficulty: 'MEDIUM', number: '02' },
  { slug: 'frequency', module: CipherModule.FREQUENCY, difficulty: 'HARD', number: '03' },
  { slug: 'vigenere', module: CipherModule.VIGENERE, difficulty: 'HARD', number: '04' },
  { slug: 'chimera', module: CipherModule.CHIMERA, difficulty: 'HARD', number: '05' },
];

/** Fixed difficulty of a module (used by the menu stamps and GameSetup). */
export function difficultyForModule(module: CipherModule): Difficulty {
  return MISSIONS.find((mission) => mission.module === module)?.difficulty ?? 'EASY';
}

/** Two-digit mission number shown in the header of a mission file. */
export function missionNumberForModule(module: CipherModule): string {
  return MISSIONS.find((mission) => mission.module === module)?.number ?? '00';
}
