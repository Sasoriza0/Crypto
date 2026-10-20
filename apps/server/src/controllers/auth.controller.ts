import type { Request, RequestHandler, Response } from 'express';
import type { AuthUser, ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from '@shiftcrack/shared';
import { ApiError } from '../lib/errors.js';
import * as authService from '../services/auth.service.js';
import * as passwordResetService from '../services/password-reset.service.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../services/session.service.js';

/**
 * Thin HTTP adapters for the auth endpoints (SDD §4). Inputs are already
 * validated by the zod middleware; these handlers only marshal service
 * results into JSON and manage the httpOnly session cookie.
 */

function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
}

function userPayload(user: Parameters<typeof authService.toPublicUser>[0]): { user: AuthUser } {
  return { user: authService.toPublicUser(user) };
}

function requireSessionId(req: Request): string {
  if (!req.sessionId) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  return req.sessionId;
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  return req.userId;
}

export const anonymous: RequestHandler = async (_req, res) => {
  const { user, sessionId } = await authService.anonymousLogin();
  setSessionCookie(res, sessionId);
  res.status(201).json(userPayload(user));
};

export const register: RequestHandler = async (req, res) => {
  const { email, nickname, password } = req.body as RegisterInput;
  const { user, sessionId } = await authService.register(email, nickname, password);
  setSessionCookie(res, sessionId);
  res.status(201).json(userPayload(user));
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginInput;
  const { user, sessionId } = await authService.login(email, password);
  setSessionCookie(res, sessionId);
  res.json(userPayload(user));
};

export const me: RequestHandler = async (req, res) => {
  const { user } = await authService.me(requireUserId(req));
  res.json(userPayload(user));
};

/**
 * POST /auth/forgot-password — the handler is deliberately thin: the
 * service answers the same way whether or not the account exists, so the
 * 202 below is the only response anyone ever sees (anti-enumeration).
 */
export const forgotPassword: RequestHandler = async (req, res) => {
  const { email } = req.body as ForgotPasswordInput;
  await passwordResetService.requestPasswordReset(email);
  res.status(202).json({ status: 'ok' });
};

/** POST /auth/reset-password — consumes the single-use token. */
export const resetPassword: RequestHandler = async (req, res) => {
  const { token, password } = req.body as ResetPasswordInput;
  await passwordResetService.resetPassword(token, password);
  res.json({ status: 'ok' });
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(requireSessionId(req));
  clearSessionCookie(res);
  res.status(204).send();
};
