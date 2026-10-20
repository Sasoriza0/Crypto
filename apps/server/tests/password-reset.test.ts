import { afterEach, describe, expect, it } from 'vitest';
import { resetPasswordSchema } from '@shiftcrack/shared';
import { buildResetEmail, resetMailTransport, sendResetEmail, smtpConfigured } from '../src/services/mail.service.js';
import {
  buildResetUrl,
  generateResetToken,
  hashResetToken,
  resetTokenTtlMs,
} from '../src/services/password-reset.service.js';

/**
 * Password-reset hardening (OWASP Forgot Password cheat sheet): 256-bit
 * CSPRNG tokens, SHA-256 at rest, short TTL with a hard floor, single-use
 * semantics and an email letter that never leaks account state. Pure
 * helpers are covered here; the DB flow is exercised by the smoke script.
 */

afterEach(() => {
  delete process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES;
  delete process.env.CLIENT_ORIGIN;
  delete process.env.SMTP_HOST;
  resetMailTransport();
});

describe('generateResetToken / hashResetToken', () => {
  it('generates unique 256-bit base64url tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateResetToken()));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes tokens with SHA-256 (deterministic, never reversible to the raw token)', () => {
    const token = generateResetToken();
    const hash = hashResetToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashResetToken(token));
    expect(hash).not.toContain(token);
  });
});

describe('resetTokenTtlMs', () => {
  it('defaults to 30 minutes when PASSWORD_RESET_TOKEN_TTL_MINUTES is missing', () => {
    delete process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES;
    expect(resetTokenTtlMs()).toBe(30 * 60_000);
  });

  it('falls back to the default on empty, garbage or non-positive values', () => {
    for (const value of ['', 'abc', '0', '-5', 'NaN']) {
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = value;
      expect(resetTokenTtlMs()).toBe(30 * 60_000);
    }
  });

  it('clamps sub-5-minute values up to 5 minutes (hard floor)', () => {
    for (const value of ['0.25', '1', '4']) {
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = value;
      expect(resetTokenTtlMs()).toBe(5 * 60_000);
    }
  });

  it('honours values above the floor', () => {
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = '45';
    expect(resetTokenTtlMs()).toBe(45 * 60_000);
  });
});

describe('buildResetUrl', () => {
  it('points at the client origin and carries the raw token URL-encoded', () => {
    process.env.CLIENT_ORIGIN = 'https://shiftcrack.example';
    const url = buildResetUrl('tok_envalue');
    expect(url).toBe('https://shiftcrack.example/reset-password?token=tok_envalue');
  });
});

describe('resetPasswordSchema', () => {
  it('enforces the OWASP password policy on the new password', () => {
    const token = generateResetToken();
    expect(resetPasswordSchema.safeParse({ token, password: 'Cipher!2026' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: 'weak' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 'not-a-token', password: 'Cipher!2026' }).success).toBe(false);
  });
});

describe('mail service (SMTP + console fallback)', () => {
  it('is not configured by default (no SMTP_HOST)', () => {
    delete process.env.SMTP_HOST;
    expect(smtpConfigured()).toBe(false);
  });

  it('detects SMTP configuration from SMTP_HOST', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    expect(smtpConfigured()).toBe(true);
  });

  it('builds a letter with the reset link and escaped content', () => {
    const { subject, text, html } = buildResetEmail({
      to: 'agent@example.com',
      nickname: '<script>alert(1)</script>',
      resetUrl: 'https://shiftcrack.example/reset-password?token=abc',
      ttlMinutes: 30,
    });
    expect(subject).toContain('Security Protocol');
    expect(text).toContain('https://shiftcrack.example/reset-password?token=abc');
    expect(text).toContain('30 minutes');
    expect(html).toContain('https://shiftcrack.example/reset-password?token=abc');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to the console transport and still composes the letter', async () => {
    delete process.env.SMTP_HOST;
    const consoleSpy = { called: false };
    const original = console.log;
    console.log = (...args: unknown[]) => {
      consoleSpy.called = true;
      void args;
    };
    try {
      await expect(
        sendResetEmail({
          to: 'agent@example.com',
          nickname: 'agent_01',
          resetUrl: 'https://shiftcrack.example/reset-password?token=abc',
          ttlMinutes: 30,
        }),
      ).resolves.toBeUndefined();
    } finally {
      console.log = original;
    }
    expect(consoleSpy.called).toBe(true);
  });
});
