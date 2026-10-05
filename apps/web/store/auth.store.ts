'use client';

import { create } from 'zustand';
import type { AuthResponse, AuthUser } from '@shiftcrack/shared';
import { authResponseSchema } from '@shiftcrack/shared';
import { api, setUnauthorizedHandler } from '@/lib/api';

/**
 * Auth store (SDD §6): holds the current user and hydrates via
 * GET /auth/me on startup. Every API 401 (expired/revoked session) funnels
 * through setUnauthorizedHandler and resets this store. Not persisted —
 * the httpOnly session cookie is the source of truth.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  hydrate: () => Promise<void>;
  playAnonymously: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: 'loading',

  hydrate: async () => {
    try {
      const { user } = await api.get<AuthResponse>('/auth/me', authResponseSchema);
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'anonymous' });
    }
  },

  playAnonymously: async () => {
    const { user } = await api.post<AuthResponse>('/auth/anonymous', undefined, authResponseSchema);
    set({ user, status: 'authenticated' });
  },

  register: async (email, password) => {
    const { user } = await api.post<AuthResponse>('/auth/register', { email, password }, authResponseSchema);
    set({ user, status: 'authenticated' });
  },

  login: async (email, password) => {
    const { user } = await api.post<AuthResponse>('/auth/login', { email, password }, authResponseSchema);
    set({ user, status: 'authenticated' });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, status: 'anonymous' });
    }
  },

  reset: () => set({ user: null, status: 'anonymous' }),
}));

setUnauthorizedHandler(() => useAuthStore.getState().reset());
