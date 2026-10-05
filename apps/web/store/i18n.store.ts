'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import en from '../messages/en.json';
import uk from '../messages/uk.json';

/**
 * i18n store (SDD §6): uk/en, persisted. `t(key)` looks the key up in the
 * active locale's message bundle and falls back to the key itself, so a
 * missing translation degrades gracefully instead of crashing the UI.
 * Placeholders like `{attempts}` are interpolated from the optional params.
 */
export type Locale = 'uk' | 'en';

export type TParams = Record<string, string | number>;

const messages: Record<Locale, Record<string, string>> = { uk, en };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TParams) => string;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'uk',
      setLocale: (locale) => set({ locale }),
      t: (key, params) => {
        const template = messages[get().locale][key] ?? key;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (_, name: string) =>
          String(params[name] ?? `{${name}}`),
        );
      },
    }),
    { name: 'sc-i18n', skipHydration: true },
  ),
);

useI18nStore.subscribe((state) => {
  if (typeof document !== 'undefined') document.documentElement.lang = state.locale;
});
