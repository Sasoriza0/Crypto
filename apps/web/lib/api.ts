import type { ZodType } from 'zod';

/**
 * Typed API client (SDD §8.3 step 4.3): a thin fetch wrapper over
 * NEXT_PUBLIC_API_URL that reuses the zod schemas from @shiftcrack/shared
 * to parse responses, sends the httpOnly session cookie via
 * `credentials: 'include'`, and notifies the auth store on 401 so the
 * user state resets immediately.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler = () => {};

/** Registered by the auth store: resets user state whenever the API says 401. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

interface RequestOptions<T> {
  method: 'GET' | 'POST';
  body?: unknown;
  schema?: ZodType<T>;
}

async function request<T>(path: string, { method, body, schema }: RequestOptions<T>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) onUnauthorized();

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const payload = (data ?? {}) as { error?: { code?: string; message?: string; details?: unknown } };
    throw new ApiError(
      res.status,
      payload.error?.code ?? 'HTTP_ERROR',
      payload.error?.message ?? `Request failed with status ${res.status}`,
      payload.error?.details,
    );
  }

  return schema ? schema.parse(data) : (data as T);
}

export const api = {
  get: <T>(path: string, schema?: ZodType<T>): Promise<T> => request<T>(path, { method: 'GET', schema }),
  post: <T>(path: string, body?: unknown, schema?: ZodType<T>): Promise<T> =>
    request<T>(path, { method: 'POST', body, schema }),
};
