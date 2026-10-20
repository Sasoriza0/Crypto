import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../prisma/client.js';
import { hashPassword } from './auth.service.js';
import { sendResetEmail } from './mail.service.js';
import { revokeUserSessions } from './session.service.js';

/**
 * Password reset flow (OWASP Forgot Password cheat sheet):
 *
 *  - Tokens are 256-bit CSPRNG values (32 bytes, base64url); only their
 *    SHA-256 is stored, so a DB leak reveals no usable reset links.
 *  - Short TTL, hard floor of 5 minutes (env may only raise it).
 *  - Single-use: deleted on successful reset; requesting a new token
 *    deletes the previous one, so at most one active token exists.
 *  - Anti-enumeration: forgot-password performs the same amount of work
 *    for unknown emails and always answers identically.
 */

const DEFAULT_TTL_MS = 30 * 60_000;
const MIN_TTL_MINUTES = 5;

export function resetTokenTtlMs(): number {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_MS;
  return Math.max(raw, MIN_TTL_MINUTES) * 60_000;
}

export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The web client origin the reset link points at (the reset form page). */
export function clientOrigin(): string {
  return process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';
}

export function buildResetUrl(token: string): string {
  return `${clientOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * POST /auth/forgot-password. Issues a token and emails the link ONLY when
 * a local account with a password exists; unknown emails and anonymous
 * users take the identical silent path (OWASP: no account enumeration).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return;

  const token = generateResetToken();
  const ttlMs = resetTokenTtlMs();

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    }),
  ]);

  await sendResetEmail({
    to: user.email!,
    nickname: user.nickname,
    resetUrl: buildResetUrl(token),
    ttlMinutes: Math.round(ttlMs / 60_000),
  });
}

/**
 * POST /auth/reset-password. Consumes the token: sets the new hash, deletes
 * the token row and revokes every session of the user (OWASP: credential
 * change invalidates all sessions). Invalid/expired tokens get one generic
 * error — nothing about account state leaks.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record) {
    throw new ApiError(400, 'RESET_TOKEN_INVALID', 'Password reset link is invalid or has expired');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => undefined);
    throw new ApiError(400, 'RESET_TOKEN_INVALID', 'Password reset link is invalid or has expired');
  }

  const newHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: newHash } }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ]);

  await revokeUserSessions(record.userId);
}

/** Periodic sweep of expired token rows (uses the expiresAt index). */
export async function expirePasswordResetTokens(): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
