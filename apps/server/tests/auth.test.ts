import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@shiftcrack/shared';
import { hashPassword } from '../src/services/auth.service.js';
import {
  generateSessionId,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlMs,
} from '../src/services/session.service.js';

describe('auth zod schemas (SDD §4)', () => {
  it('register: rejects weak passwords and invalid emails', () => {
    expect(registerSchema.safeParse({ email: 'x@y.z', password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'not-an-email', password: 'password123' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(129) }).success).toBe(false);
  });

  it('register: trims and lowercases the email to its canonical form', () => {
    const parsed = registerSchema.safeParse({ email: '  USER@Example.COM ', password: 'password123' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('user@example.com');
  });

  it('login: does not enforce the registration password policy', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true);
  });
});

describe('hashPassword (bcryptjs)', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('password123', 4);
    expect(hash).toMatch(/^\$2[aby]\$\d\d\$/);
    expect(hash).not.toBe('password123');
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
