import { afterEach, describe, expect, it } from 'vitest';
import { gameSessionTtlMs } from '../src/services/game.service.js';
import { sessionTtlMs } from '../src/services/session.service.js';

/**
 * Session-TTL hardening (bug fix): a crypto solve can take 10+ minutes of
 * purely local client work with zero network requests, so both the auth
 * session TTL and the game session TTL must never drop below 24h. Missing,
 * empty, garbage and sub-24h env values all resolve to a full day.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  delete process.env.SESSION_TTL_HOURS;
  delete process.env.GAME_SESSION_TTL_MINUTES;
});

describe('sessionTtlMs — 24h hard floor', () => {
  it('defaults to 24h when SESSION_TTL_HOURS is missing', () => {
    delete process.env.SESSION_TTL_HOURS;
    expect(sessionTtlMs()).toBe(DAY_MS);
  });

  it('falls back to 24h on empty, garbage or non-positive values', () => {
    for (const value of ['', 'abc', '0', '-1', 'NaN', 'Infinity']) {
      process.env.SESSION_TTL_HOURS = value;
      expect(sessionTtlMs()).toBe(DAY_MS);
    }
  });

  it('clamps sub-24h values up to 24h (12-minute sessions are the bug)', () => {
    process.env.SESSION_TTL_HOURS = '0.25';
    expect(sessionTtlMs()).toBe(DAY_MS);
  });

  it('honours values above 24h', () => {
    process.env.SESSION_TTL_HOURS = '48';
    expect(sessionTtlMs()).toBe(48 * 3_600_000);
  });
});

describe('gameSessionTtlMs — 24h hard floor', () => {
  it('defaults to 24h when GAME_SESSION_TTL_MINUTES is missing', () => {
    delete process.env.GAME_SESSION_TTL_MINUTES;
    expect(gameSessionTtlMs()).toBe(DAY_MS);
  });

  it('falls back to 24h on empty, garbage or non-positive values', () => {
    for (const value of ['', 'abc', '0', '-30', 'NaN']) {
      process.env.GAME_SESSION_TTL_MINUTES = value;
      expect(gameSessionTtlMs()).toBe(DAY_MS);
    }
  });

  it('clamps sub-24h values up to 24h (10-30 minute sessions are the bug)', () => {
    for (const value of ['10', '15', '30', '60']) {
      process.env.GAME_SESSION_TTL_MINUTES = value;
      expect(gameSessionTtlMs()).toBe(DAY_MS);
    }
  });

  it('honours values above 1440 minutes', () => {
    process.env.GAME_SESSION_TTL_MINUTES = '2880';
    expect(gameSessionTtlMs()).toBe(2 * DAY_MS);
  });
});
