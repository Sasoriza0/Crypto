'use client';

import { useParams } from 'next/navigation';
import { ModuleScreen } from '@/components/game/ModuleScreen';

/**
 * Dynamic module route (SDD §2): `/modules/<slug>` resolves the slug
 * against the shared CipherModule enum inside ModuleScreen.
 */
export default function ModulePage() {
  const { slug } = useParams<{ slug: string }>();
  return <ModuleScreen slug={slug} />;
}
