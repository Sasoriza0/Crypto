import bcrypt from 'bcryptjs';
import type { User } from '../generated/prisma/client.js';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../prisma/client.js';
import { createSession, revokeSession } from './session.service.js';

/**
 * Authentication service (SDD §8.3 step 4.2, Option A).
 *
 * Hybrid user model: anonymous play with zero friction, optional local
 * accounts (email + bcrypt, cost 12). Every successful auth step issues a
 * fresh server-side Session row whose id is the httpOnly cookie value, so
 * logout can revoke and login can rotate ids (SDD §5).
 */

/**
 * bcrypt cost; tunable via env so tests can lower it, default 12 per SDD.
 * BCRYPT_COST is clamped to the 4..15 range bcryptjs supports.
 */
export function bcryptCost(): number {
  const raw = Number(process.env.BCRYPT_COST ?? 12);
  if (!Number.isInteger(raw)) return 12;
  return Math.min(15, Math.max(4, raw));
}

export async function hashPassword(password: string, cost = bcryptCost()): Promise<string> {
  return bcrypt.hash(password, cost);
}

/**
 * Precomputed bcrypt hash used to equalize response time when the account
 * does not exist — otherwise login would leak account presence by timing.
 */
const DUMMY_HASH = '$2b$10$537A6ZIWY1AnP7wVBZZy4OAAaz6wc.RWn5lhukT3O2PYYJ.ordrF6';

/** Public projection: the password hash never leaves the service layer. */
export function toPublicUser(user: User): { id: string; email: string | null; provider: string } {
  return { id: user.id, email: user.email, provider: user.provider };
}

export async function anonymousLogin(): Promise<{ user: User; sessionId: string }> {
  const user = await prisma.user.create({ data: { provider: 'anonymous' } });
  const session = await createSession(user.id);
  return { user, sessionId: session.id };
}

export async function register(
  email: string,
  password: string,
): Promise<{ user: User; sessionId: string }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'CONFLICT', 'An account with this email already exists');
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), provider: 'local' },
  });
  const session = await createSession(user.id);
  return { user, sessionId: session.id };
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: User; sessionId: string }> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Timing-safe compare even when the account is missing or has no password
  // (anonymous accounts): bcrypt against the dummy hash keeps the failure
  // path on the same clock as a real comparison.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(password, hash);
  if (!user || !matches) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  // Session id rotation (SDD §5): revoke every previous session for the
  // user and issue a fresh one, killing any stolen/stale cookies.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  const session = await createSession(user.id);
  return { user, sessionId: session.id };
}

export async function me(userId: string): Promise<{ user: User }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Session invalid or expired');
  }
  return { user };
}

export async function logout(sessionId: string): Promise<void> {
  await revokeSession(sessionId);
}
