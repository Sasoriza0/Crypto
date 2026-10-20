import { Router } from 'express';
import { leaderboardQuerySchema } from '@shiftcrack/shared';
import * as leaderboardController from '../controllers/leaderboard.controller.js';
import { attachSession } from '../middleware/session.js';
import { validate } from '../middleware/validate.js';

/**
 * Leaderboard routes (SDD Phase 8), mounted under /api/v1/leaderboards.
 * The Hall of Fame is read-only and requires a session like the game
 * routes; the `module` query param is validated at the API edge so only
 * the two competitive missions can ever be ranked.
 */
export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  attachSession,
  validate(leaderboardQuerySchema, 'query'),
  leaderboardController.getLeaderboard,
);
