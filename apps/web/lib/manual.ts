import type { CipherModule } from '@shiftcrack/shared';

/**
 * Section 9 Field Manual content descriptors. The actual bilingual text
 * lives in the i18n messages (en/uk) under `manual.<id>.*` — this module
 * only declares the STRUCTURE (which sections exist, in which order, how
 * many algorithm steps each one has) so both the global manual and the
 * in-game cipher reference render from one source of truth.
 */

export type ManualSectionId = 'frequency' | 'caesar' | 'vigenere' | 'transposition';

export interface ManualSection {
  id: ManualSectionId;
  /** Playable module this section documents (used for in-game help). */
  module: CipherModule;
  /** i18n key of the section title (reuses the mission names). */
  titleKey: string;
  /** i18n key of the red mission stamp (thematic subtitle). */
  missionKey: string;
  /** i18n key of the theoretical description. */
  theoryKey: string;
  /** i18n key of the mathematical/logical basis. */
  mathKey: string;
  /** i18n keys of the numbered decryption-algorithm steps. */
  stepKeys: string[];
}

function section(
  id: ManualSectionId,
  module: CipherModule,
  stepCount: number,
): ManualSection {
  return {
    id,
    module,
    titleKey: `modules.${id}.name`,
    missionKey: `menu.subtitle.${id}`,
    theoryKey: `manual.${id}.theory`,
    mathKey: `manual.${id}.math`,
    stepKeys: Array.from({ length: stepCount }, (_, i) => `manual.${id}.step.${i + 1}`),
  };
}

/** Manual roster, in menu order. */
export const MANUAL_SECTIONS: ManualSection[] = [
  section('frequency', 'FREQUENCY', 5),
  section('caesar', 'CAESAR', 5),
  section('vigenere', 'VIGENERE', 5),
  section('transposition', 'TRANSPOSITION', 5),
];

/** The field-manual section for a playable module (CHIMERA has none). */
export function manualSectionForModule(module: CipherModule): ManualSection | undefined {
  return MANUAL_SECTIONS.find((entry) => entry.module === module);
}
