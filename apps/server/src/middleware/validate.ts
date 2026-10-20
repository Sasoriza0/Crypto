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
    // Express 5 exposes `req.query` (and other segments) as getter-only
    // accessors on the Request prototype, so plain assignment throws
    // ("Cannot set property ... which has only a getter"). Define an own
    // property instead: it shadows the accessor for this request with the
    // parsed value and keeps the replacement for downstream handlers.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
}
