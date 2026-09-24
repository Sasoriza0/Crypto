import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma/client.js';

/**
 * Server-side session store (SDD §8.3 step 4.2, Option A). Session ids are
 * 256-bit CSPRNG tokens carried in an httpOnly cookie; the row lives in the
 * Session table so logout can revoke and login can rotate ids. This module
 * covers the store primitives — the auth endpoints arrive in step 4.2.
 */

export const SESSION_COOKIE = 'sc_sid';

export function sessionTtlMs(): number {
  return Number(process.env.SESSION_TTL_HOURS ?? 24) * 3_600_000;
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
