'use client';

import { useEffect } from 'react';
import type { SessionPingResponse } from '@shiftcrack/shared';
import { sessionPingResponseSchema } from '@shiftcrack/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

/**
 * Session heartbeat (SDD §5): while an authenticated session exists, ping
 * the API every PING_INTERVAL_MS. Crypto solves — especially frequency
 * analysis — happen entirely on the client, so a player can go 10+ minutes
 * without a single network request; without this ping the sliding
 * server-side session renewal never fires and the session + cookie can die
 * mid-thought. Rendered once in the root layout; returns no UI.
 */
export const PING_INTERVAL_MS = 4 * 60 * 1000;

export function SessionKeepAlive() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');

  useEffect(() => {
    if (!authenticated) return;

    const ping = () => {
      api
        .get<SessionPingResponse>('/session/ping', sessionPingResponseSchema)
        .catch(() => {
          // Silent: a dead session surfaces as a 401 on the next real
          // request (the api client resets the auth store in that case).
        });
    };

    const timer = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [authenticated]);

  return null;
}
