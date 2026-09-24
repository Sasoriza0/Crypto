import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import { prisma } from '../prisma/client.js';
import { SESSION_COOKIE } from '../services/session.service.js';

/**
 * Session guard (SDD §5): resolves the httpOnly session cookie into a
 * Session row, lazily deletes expired rows, and attaches userId/sessionId
 * to the request. The auth endpoints that ISSUE sessions arrive in
 * step 4.2; this middleware already protects every /api/v1/game route.
 */

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export async function attachSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!sid) {
    next(unauthorized('Authentication required'));
    return;
  }

  const session = await prisma.session.findUnique({ where: { id: sid } });
  if (!session) {
    next(unauthorized('Session invalid or expired'));
    return;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: sid } }).catch(() => undefined);
    next(unauthorized('Session invalid or expired'));
    return;
  }

  req.userId = session.userId;
  req.sessionId = session.id;
  next();
}

/** Alias — game routes require an authenticated session. */
export const requireAuth = attachSession;
