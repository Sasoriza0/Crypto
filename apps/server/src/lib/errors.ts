import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'SESSION_LOCKED'
  | 'SESSION_EXPIRED'
  | 'SESSION_NOT_ACTIVE'
  | 'INTERNAL';

/**
 * Single error model for the whole API (SDD §8.3 step 4.1): every failure
 * leaves as `{ error: { code, message, details? } }` with a stable code the
 * client can switch on. Details never leak internals (no SQL, no stacks).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = 'Resource not found'): ApiError {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function unauthorized(message = 'Authentication required'): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function validation(message = 'Invalid request payload', details?: unknown): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details);
}

/** Terminal Express error handler; maps known failures to stable codes. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload', details: err.flatten() } });
    return;
  }

  // body-parser failures (malformed / oversized JSON)
  const parseError = err as { type?: string };
  if (parseError.type === 'entity.parse.failed' || parseError.type === 'entity.too.large') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed request body' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
}
