import type { RequestHandler } from 'express';
import type { LeaderboardQuery } from '@shiftcrack/shared';
import * as leaderboardService from '../services/leaderboard.service.js';

/**
 * Thin HTTP adapter for GET /leaderboards (SDD Phase 8). The module query
 * param is already validated by the zod middleware; this handler only
 * marshals the ranked entries into the shared response envelope.
 */
export const getLeaderboard: RequestHandler = async (req, res) => {
  const { module } = req.query as LeaderboardQuery;
  const entries = await leaderboardService.getLeaderboard(module);
  res.json({ entries });
};
