import { describe, expect, it } from 'vitest';
import { loginSchema, nicknameSchema, passwordPolicySchema, registerSchema, resetTokenSchema } from '@shiftcrack/shared';
import { hashPassword } from '../src/services/auth.service.js';
import {
  generateSessionId,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlMs,
} from '../src/services/session.service.js';

describe('auth zod schemas (SDD §4)', () => {
  it('register: rejects weak passwords and invalid emails', () => {
    expect(registerSchema.safeParse({ email: 'x@y.z', nickname: 'agent_01', password: 'short' }).success).toBe(false);
    expect(
      registerSchema.safeParse({ email: 'not-an-email', nickname: 'agent_01', password: 'Cipher!2026' }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ email: 'a@b.co', nickname: 'agent_01', password: 'x'.repeat(129) }).success,
    ).toBe(false);
  });

  it('register: trims and lowercases the email to its canonical form', () => {
    const parsed = registerSchema.safeParse({
      email: '  USER@Example.COM ',
      nickname: 'agent_01',
      password: 'Cipher!2026',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('user@example.com');
  });

  it('register: requires a nickname', () => {
    expect(
      registerSchema.safeParse({ email: 'user@example.com', password: 'Cipher!2026' }).success,
    ).toBe(false);
  });

  it('passwordPolicy: requires 8+ chars with upper, lower, digit and special', () => {
    expect(passwordPolicySchema.safeParse('Cipher!2026').success).toBe(true);
    expect(passwordPolicySchema.safeParse('nocaps!2026').success).toBe(false); // no uppercase
    expect(passwordPolicySchema.safeParse('CIPHER!2026').success).toBe(false); // no lowercase
    expect(passwordPolicySchema.safeParse('Cipher!word').success).toBe(false); // no digit
    expect(passwordPolicySchema.safeParse('Cipher2026').success).toBe(false); // no special char
    expect(passwordPolicySchema.safeParse('Ci!26').success).toBe(false); // too short
    expect(passwordPolicySchema.safeParse('x'.repeat(129)).success).toBe(false); // too long
  });

  it('nickname: only 3-15 safe characters (letters, digits, "_", ".", "-")', () => {
    expect(nicknameSchema.safeParse('agent_01').success).toBe(true);
    expect(nicknameSchema.safeParse('A.b-c').success).toBe(true);
    expect(nicknameSchema.safeParse('ab').success).toBe(false); // too short
    expect(nicknameSchema.safeParse('a'.repeat(16)).success).toBe(false); // too long
    expect(nicknameSchema.safeParse('bad nick').success).toBe(false); // space
    expect(nicknameSchema.safeParse('nick<>!').success).toBe(false); // unsafe chars
    expect(nicknameSchema.safeParse('  agent_01  ').success).toBe(true); // trimmed
  });

  it('login: does not enforce the registration password policy', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true);
  });

  it('resetTokenSchema: accepts only base64url 256-bit tokens (43 chars)', () => {
    expect(resetTokenSchema.safeParse('A'.repeat(43)).success).toBe(true);
    expect(resetTokenSchema.safeParse('abc').success).toBe(false);
    expect(resetTokenSchema.safeParse('a+b/c=').success).toBe(false);
  });
});

describe('hashPassword (bcryptjs)', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('Cipher!2026', 4);
    expect(hash).toMatch(/^\$2[aby]\$\d\d\$/);
    expect(hash).not.toBe('Cipher!2026');
  });

  it('salts every hash', async () => {
    const a = await hashPassword('same-password', 4);
    const b = await hashPassword('same-password', 4);
    expect(a).not.toBe(b);
  });
});

describe('session store primitives (Option A)', () => {
  it('generates unique 256-bit base64url session ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('derives the TTL from SESSION_TTL_HOURS', () => {
    const previous = process.env.SESSION_TTL_HOURS;
    process.env.SESSION_TTL_HOURS = '48';
    expect(sessionTtlMs()).toBe(48 * 3_600_000);
    if (previous === undefined) delete process.env.SESSION_TTL_HOURS;
    else process.env.SESSION_TTL_HOURS = previous;
  });

  it('exposes httpOnly + SameSite=Lax cookie options with a matching maxAge', () => {
    const options = sessionCookieOptions(1_000);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(1_000);
    expect(SESSION_COOKIE).toBe('sc_sid');
  });
});
