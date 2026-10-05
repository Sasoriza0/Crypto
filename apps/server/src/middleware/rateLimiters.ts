import rateLimit from 'express-rate-limit';

/**
 * Per-endpoint limiters (SDD §5): the attempts endpoint is the brute-force
 * surface, so it gets a much stricter window than the global limiter.
 * Default 10/min per IP, aligned with the per-session lockout threshold.
 */
export const attemptsLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_ATTEMPTS_MAX ?? 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' } },
});

/**
 * Credential endpoints (SDD §8.3 step 4.2): anonymous/register/login are the
 * brute-force surface for account enumeration and password guessing, so they
 * get a window 6x stricter than the global limiter (10/min/IP).
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many auth requests, try again later' } },
});
