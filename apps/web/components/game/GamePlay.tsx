'use client';

import { useEffect, useState } from 'react';
import type { CipherModule } from '@shiftcrack/shared';
import { CaesarPanel } from '@/components/cipher/CaesarPanel';
import { TranspositionPanel } from '@/components/cipher/TranspositionPanel';
import { VigenerePanel } from '@/components/cipher/VigenerePanel';
import { FrequencyPanel } from '@/components/frequency/FrequencyPanel';
import { AnswerPanel } from '@/components/game/AnswerPanel';
import { ChimeraPanel } from '@/components/game/ChimeraPanel';
import { ContextBanner } from '@/components/game/ContextBanner';
import { HintsPanel } from '@/components/game/HintsPanel';
import { HowToPlay } from '@/components/game/HowToPlay';
import { StatusBar } from '@/components/game/StatusBar';
import { CipherReference } from '@/components/manual/CipherReference';
import { useFrequencyStore } from '@/store/frequency.store';
import { useGameStore } from '@/store/game.store';

/**
 * Active-game screen: timer + status strip, the module panel, hints and the
 * answer form. The candidate produced by a panel can be piped into the
 * answer input via onUseCandidate. CAESAR and FREQUENCY embed the shared
 * AnswerPanel inside their own two-column layouts; TRANSPOSITION renders
 * it right below the route grid.
 */
export function GamePlay({ module }: { module: CipherModule }) {
  const session = useGameStore((s) => s.session);
  const status = useGameStore((s) => s.status);

  const [answer, setAnswer] = useState('');

  // Reset per-session UI state when a new session starts.
  useEffect(() => {
    setAnswer('');
    useFrequencyStore.getState().reset();
  }, [session?.id]);

  // Timer ticks once per second while playing.
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      useGameStore.getState().tick();
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  if (!session) return null;

  return (
    <div className="mt-1 w-full p-3 md:p-6">
      <div className="flex flex-col gap-2 border-b border-tan pb-3 md:flex-row md:items-center md:justify-between">
        <StatusBar />
        <div className="flex flex-wrap items-center gap-2">
          <CipherReference module={module} />
          <HowToPlay module={module} />
        </div>
      </div>

      {module === 'FREQUENCY' && <ContextBanner contextClue={session.meta.contextClue} />}

      {module === 'CAESAR' && (
        <CaesarPanel
          ciphertext={session.ciphertext}
          language={session.language}
          difficulty={session.difficulty}
          answer={answer}
          onAnswerChange={setAnswer}
          onUseCandidate={setAnswer}
        />
      )}
      {module === 'TRANSPOSITION' && (
        <>
          <TranspositionPanel
            ciphertext={session.ciphertext}
            textLength={session.meta.textLength}
            onUseCandidate={setAnswer}
          />
          <AnswerPanel answer={answer} onAnswerChange={setAnswer} className="mt-3 max-w-xl" />
        </>
      )}
      {module === 'FREQUENCY' && (
        <FrequencyPanel
          ciphertext={session.ciphertext}
          language={session.language}
          answer={answer}
          onAnswerChange={setAnswer}
          onUseCandidate={setAnswer}
        />
      )}
      {module === 'VIGENERE' && (
        <VigenerePanel
          ciphertext={session.ciphertext}
          language={session.language}
          answer={answer}
          onAnswerChange={setAnswer}
          onUseCandidate={setAnswer}
        />
      )}
      {module === 'CHIMERA' && <ChimeraPanel />}

      {module !== 'CAESAR' && <HintsPanel />}
    </div>
  );
}
