'use client';

import { useI18nStore } from '@/store/i18n.store';
import type { TParams } from '@/store/i18n.store';

/**
 * Reactive translate hook. Components must subscribe to the `locale` so they
 * re-render when the language switches — selecting `t` alone never does:
 * the function reference is stable across store updates (this was the bug
 * where only the header translated). The function itself is read from
 * getState() and always resolves against the current locale.
 */
export function useT(): (key: string, params?: TParams) => string {
  useI18nStore((s) => s.locale);
  return useI18nStore.getState().t;
}
