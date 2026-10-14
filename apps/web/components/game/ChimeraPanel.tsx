'use client';

import { Phase1MitM } from '@/components/chimera/Phase1MitM';
import { Phase2Ecb } from '@/components/chimera/Phase2Ecb';
import { Phase3Jwt } from '@/components/chimera/Phase3Jwt';
import { useT } from '@/lib/i18n';
import { useGameStore } from '@/store/game.store';

/**
 * CHIMERA mission wrapper (Mission 05): renders the phase the session is
 * in — Phase 1 (MitM packet injection), Phase 2 (AES-ECB block
 * substitution) or Phase 3 (JWT forge). The strip above summarizes
 * progress; the phase transitions happen through the buttons of each
 * phase board.
 */
export function ChimeraPanel() {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const chimeraPhase = useGameStore((s) => s.chimeraPhase);
  const isMitMSuccessful = useGameStore((s) => s.isMitMSuccessful);
  const chimeraForgedJson = useGameStore((s) => s.chimeraForgedJson);

  if (!session) return null;

  const metaPhase = session.meta.chimera?.phase ?? 1;
  const phase1Done = isMitMSuccessful || metaPhase >= 2;
  const phase2Done = chimeraForgedJson !== null || metaPhase >= 3;
  const phase3Done = metaPhase >= 3;

  const doneOf = (phase: 1 | 2 | 3) =>
    phase === 1 ? phase1Done : phase === 2 ? phase2Done : phase3Done;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-tan pb-2">
        {([1, 2, 3] as const).map((phase) => {
          const active = phase === chimeraPhase;
          const done = doneOf(phase);
          return (
            <span
              key={phase}
              className={`border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${
                active
                  ? 'border-red-700 bg-red-700 text-paper'
                  : done
                    ? 'border-emerald-700 text-emerald-700'
                    : 'border-tan text-fade'
              }`}
            >
              {t(`chimera.phase.strip.${phase}`)} {done ? '✓' : ''}
            </span>
          );
        })}
      </div>

      {chimeraPhase === 1 && <Phase1MitM />}
      {chimeraPhase === 2 && <Phase2Ecb />}
      {chimeraPhase === 3 && <Phase3Jwt />}
    </div>
  );
}
