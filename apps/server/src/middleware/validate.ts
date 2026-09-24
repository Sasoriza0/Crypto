import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { validation } from '../lib/errors.js';

type Source = 'body' | 'params' | 'query';

/**
 * Zod validation middleware (SDD §5: every input is validated at the API
 * edge). Replaces the request segment with the parsed value so downstream
 * handlers get typed, coerced data.
 */
export function validate<T>(schema: ZodType<T>, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(validation('Invalid request payload', result.error.flatten()));
      return;
    }
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}
