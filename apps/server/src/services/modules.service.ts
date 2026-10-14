import type { ModuleMetadata } from '@shiftcrack/shared';
import { CipherModule, Difficulty } from '@shiftcrack/shared';

/**
 * Static module metadata (SDD §4: GET /game/modules). Pure constants — the
 * client uses this to render module lists/guides without hardcoding.
 */
export function listModules(): ModuleMetadata[] {
  return [
    { id: CipherModule.CAESAR, slug: 'caesar', difficulties: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD] },
    {
      id: CipherModule.TRANSPOSITION,
      slug: 'transposition',
      difficulties: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD],
    },
    { id: CipherModule.FREQUENCY, slug: 'frequency', difficulties: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD] },
    { id: CipherModule.VIGENERE, slug: 'vigenere', difficulties: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD] },
    // Mission 05: the three-phase composite challenge is HARD-only.
    { id: CipherModule.CHIMERA, slug: 'chimera', difficulties: [Difficulty.HARD] },
  ];
}
