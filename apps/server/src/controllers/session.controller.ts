import type { Request, RequestHandler } from 'express';
import type { SessionPingResponse } from '@shiftcrack/shared';
import { ApiError } from '../lib/errors.js';
import { touchActiveGameSessions } from '../services/game.service.js';
import { SESSION_COOKIE, sessionCookieOptions, touchSession } from '../services/session.service.js';

/**
 * Session keep-alive (SDD §5 extension). The browser solves ciphers locally
 * for minutes at a time without any network traffic, so neither the sliding
 * renewal in the session middleware nor the game services ever fire. This
 * heartbeat endpoint lets the client explicitly refresh:
 *
 *   - the server-side Session row (full TTL forward),
 *   - the httpOnly cookie (fresh maxAge),
 *   - every ACTIVE GameSession of the user (no mid-thought expiry).
 */

function requireSessionId(req: Request): string {
  if (!req.sessionId) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  return req.sessionId;
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  return req.userId;
}

export const ping: RequestHandler = async (req, res) => {
  const sessionId = requireSessionId(req);
  const userId = requireUserId(req);

  const session = await touchSession(sessionId);
  await touchActiveGameSessions(userId);
  res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());

  const payload: SessionPingResponse = { status: 'ok', expiresAt: session.expiresAt.toISOString() };
  res.json(payload);
};
