import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma/client.js';

/**
 * Server-side session store (SDD §8.3 step 4.2, Option A). Session ids are
 * 256-bit CSPRNG tokens carried in an httpOnly cookie; the row lives in the
 * Session table so logout can revoke and login can rotate ids. This module
 * covers the store primitives — the auth endpoints arrive in step 4.2.
 */

export const SESSION_COOKIE = 'sc_sid';

/**
 * Hard 24h floor: a crypto solve can take tens of minutes of pure local
 * thinking (no network traffic at all), so anything shorter can kill the
 * session while the player is still working. The TTL must never drop below
 * a full day — `SESSION_TTL_HOURS` may only raise it. Missing, empty,
 * NaN or sub-24h values all fall back to the 24h default, because
 * `Number('') === 0` and `Number('0.25')` previously produced 12-minute
 * sessions when a deploy injected a stray env value.
 */
export const MIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function sessionTtlMs(): number {
  const raw = Number(process.env.SESSION_TTL_HOURS);
  if (!Number.isFinite(raw) || raw <= 0) return MIN_SESSION_TTL_MS;
  return Math.max(raw, 24) * 3_600_000;
}

export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string, ttlMs = sessionTtlMs()) {
  return prisma.session.create({
    data: {
      id: generateSessionId(),
      userId,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
}

export async function revokeSession(id: string): Promise<void> {
  await prisma.session.delete({ where: { id } }).catch(() => undefined);
}

/**
 * Revoke every session of a user. Called after a password change/reset
 * (OWASP: session invalidation on credential change) — any cookie stolen
 * before the reset dies with it.
 */
export async function revokeUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

/**
 * Sliding renewal: pushes the row's expiry forward by a full TTL. Called by
 * the session middleware once a session passes half its lifetime, so an
 * active player can never be dropped mid-solve. Returns the updated row so
 * callers (e.g. the ping heartbeat) can report the new expiry.
 */
export async function touchSession(id: string, ttlMs = sessionTtlMs()) {
  return prisma.session.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() + ttlMs) },
  });
}

/** Cookie attributes per SDD §5; wired into auth endpoints in step 4.2. */
export function sessionCookieOptions(ttlMs = sessionTtlMs()): {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlMs,
  };
}
