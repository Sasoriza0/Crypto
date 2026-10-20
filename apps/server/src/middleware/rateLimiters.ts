import rateLimit from 'express-rate-limit';

/**
 * Per-endpoint limiters (SDD §5): the attempts endpoint is the brute-force
 * surface, so it gets a much stricter window than the global limiter.
 * Default 10/min per IP, aligned with the per-session lockout threshold.
 *
 * Dev budget: local development and CI smoke runs legitimately burst far
 * beyond the production per-IP budgets (the smoke script alone issues a
 * dozen credential calls within seconds, and repeated runs land in the
 * same window). Production keeps the strict configured values; every other
 * environment multiplies them by DEV_LIMIT_MULTIPLIER so the middleware
 * still runs — rate-limit wiring stays exercised and testable — without
 * ever blocking automated tooling.
 */
const DEV_LIMIT_MULTIPLIER = 1000;

/**
 * Shared by the global limiter (app.ts) and the per-endpoint limiters
 * below: production keeps the strict configured values; every other
 * environment multiplies them so local dev and CI smoke runs (which
 * legitimately burst, e.g. two smoke runs back to back ≈ 110+ requests)
 * never trip the middleware.
 */
export function effectiveLimit(configured: number): number {
  return process.env.NODE_ENV === 'production' ? configured : configured * DEV_LIMIT_MULTIPLIER;
}

export const attemptsLimiter = rateLimit({
  windowMs: 60_000,
  limit: effectiveLimit(Number(process.env.RATE_LIMIT_ATTEMPTS_MAX ?? 10)),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' } },
});

/**
 * CHIMERA structured actions (Mission 05). Looser than the attempts
 * limiter on purpose: the phase-3 JWT timing oracle is solved by sending
 * hundreds of measurement probes, which is the mechanic itself, not abuse.
 */
export const chimeraLimiter = rateLimit({
  windowMs: 60_000,
  limit: effectiveLimit(Number(process.env.RATE_LIMIT_CHIMERA_MAX ?? 120)),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many probes, try again later' } },
});

/**
 * Credential endpoints (SDD §8.3 step 4.2): anonymous/register/login are the
 * brute-force surface for account enumeration and password guessing, so they
 * get a window 6x stricter than the global limiter (10/min/IP).
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: effectiveLimit(Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10)),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many auth requests, try again later' } },
});

/**
 * Password reset endpoints: the strictest window of all. Forgot-password
 * triggers outbound email (mailbox-bombing surface) and reset-password is a
 * token brute-force surface — 5 requests / 15 min / IP by default.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: effectiveLimit(Number(process.env.RATE_LIMIT_PASSWORD_RESET_MAX ?? 5)),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many reset requests, try again later' } },
});
