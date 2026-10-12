'use client';

import { useEffect } from 'react';
import { CipherModule } from '@shiftcrack/shared';
import { FailedCard } from '@/components/game/FailedCard';
import { GamePlay } from '@/components/game/GamePlay';
import { GameSetup } from '@/components/game/GameSetup';
import { SolvedCard } from '@/components/game/SolvedCard';
import { Scratchpad } from '@/components/ui/Scratchpad';
import { useT } from '@/lib/i18n';
import { getSavedGame, useGameStore } from '@/store/game.store';
import { useScratchpadStore } from '@/store/scratchpad.store';

/**
 * Module game screen (SDD §2): validates the slug against the shared
 * CipherModule enum, resumes an in-flight game after a reload (via
 * GET /game/sessions/:id), then renders the right screen for the current
 * game state — setup (difficulty + start), active play, solved or finished.
 *
 * Shared by the dynamic route `app/modules/[slug]/page.tsx` and the static
 * `app/modules/vigenere/page.tsx` (Mission 04 gets a canonical URL).
 */
export function ModuleScreen({ slug }: { slug: string }) {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const status = useGameStore((s) => s.status);

  const module = (Object.values(CipherModule) as string[]).find(
    (value) => value.toLowerCase() === slug?.toLowerCase(),
  ) as CipherModule | undefined;

  // Per-module session isolation: a live session only renders for its own
  // module. Foreign sessions are wiped from memory (their saved ids stay
  // intact) and only this module's saved game may resume.
  useEffect(() => {
    if (!module) return;
    const store = useGameStore.getState();
    if (store.session && store.module === module) return;
    if (store.session) store.resetLocal();
    const saved = getSavedGame(module);
    if (saved) void store.resume(module, saved.sessionId);
  }, [module]);

  // The scratchpad follows the live session: notes load per session id and
  // are dropped when there is no session at all.
  useEffect(() => {
    const store = useScratchpadStore.getState();
    if (session) store.load(session.id);
    else store.clear();
  }, [session?.id, session]);

  return (
    <section className="mx-auto max-w-5xl">
      {!module ? (
        <h1 className="mt-4 font-serif text-3xl font-bold">{t('module.notFound')}</h1>
      ) : (
        <>
          {!session || status === 'idle' ? (
            <GameSetup module={module} />
          ) : status === 'solved' ? (
            <SolvedCard />
          ) : session.status === 'ACTIVE' ? (
            <GamePlay module={module} />
          ) : (
            <FailedCard status={session.status} />
          )}

          <Scratchpad />
        </>
      )}
    </section>
  );
}
