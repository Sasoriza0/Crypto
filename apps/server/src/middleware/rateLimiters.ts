import rateLimit from 'express-rate-limit';

/**
 * Per-endpoint limiters (SDD §5): the attempts endpoint is the brute-force
 * surface, so it gets a much stricter window than the global limiter.
 */
export const attemptsLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_ATTEMPTS_MAX ?? 5),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' } },
});
