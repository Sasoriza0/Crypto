import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler } from './lib/errors.js';
import { gameRouter } from './routes/game.js';

/**
 * Express app factory for ShiftCrack.
 *
 * Security posture (OWASP Top 10 baseline, see docs/SDD.md §5):
 * - helmet with a tuned CSP (dev relaxes CSP/HSTS because there is no TLS)
 * - CORS locked to CLIENT_ORIGIN with credentials (httpOnly session cookie)
 * - JSON body parser with a hard size cap
 * - global per-IP rate limit (express-rate-limit, env-tunable)
 * - no X-Powered-By, no stack traces in error responses
 *
 * Route modules (auth, game) will be mounted under /api/v1 in later steps.
 */
export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');

  // express-rate-limit keys by IP; when running behind a reverse proxy
  // (EC2 deploy), the proxy must be trusted for X-Forwarded-For to work.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
  }

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      hsts: isProd ? undefined : false,
    }),
  );

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '32kb' }));

  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
      limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/v1/game', gameRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
  });

  app.use(errorHandler);

  return app;
}
