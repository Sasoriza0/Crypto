'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Theme store (SDD §6): light/dark, persisted. Hydration is skipped at
 * module load and deferred to the header effect so the first client render
 * matches the server HTML; an inline bootstrap script in layout.tsx applies
 * the persisted theme before paint to avoid a flash.
 */
export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
    }),
    { name: 'sc-theme', skipHydration: true },
  ),
);

useThemeStore.subscribe((state) => applyTheme(state.theme));
