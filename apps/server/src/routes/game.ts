import { Router } from 'express';
import { z } from 'zod';
import { createGameSessionSchema, sessionIdSchema, submitAttemptSchema } from '@shiftcrack/shared';
import * as gameController from '../controllers/game.controller.js';
import { attemptsLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/session.js';
import { validate } from '../middleware/validate.js';

/**
 * Game routes (SDD §4), mounted under /api/v1/game. Every route requires
 * an authenticated session; the attempts endpoint additionally carries a
 * strict per-IP limiter.
 */
export const gameRouter = Router();

const sessionParamsSchema = z.object({ id: sessionIdSchema });

gameRouter.use(requireAuth);

gameRouter.post('/sessions', validate(createGameSessionSchema), gameController.createSession);
gameRouter.get('/sessions/:id', validate(sessionParamsSchema, 'params'), gameController.getSession);
gameRouter.post(
  '/sessions/:id/attempts',
  attemptsLimiter,
  validate(sessionParamsSchema, 'params'),
  validate(submitAttemptSchema),
  gameController.submitAttempt,
);
gameRouter.post('/sessions/:id/hints', validate(sessionParamsSchema, 'params'), gameController.requestHint);
gameRouter.post('/sessions/:id/abandon', validate(sessionParamsSchema, 'params'), gameController.abandonSession);
