import { ModuleScreen } from '@/components/game/ModuleScreen';

/**
 * Canonical Mission 04 route (SDD Phase 6 extension): the Vigenère cipher
 * gets a stable static URL next to the dynamic module routes.
 */
export default function VigenerePage() {
  return <ModuleScreen slug="vigenere" />;
}
