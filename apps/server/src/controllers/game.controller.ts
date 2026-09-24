import type { Request, RequestHandler } from 'express';
import type { CreateGameSessionInput } from '@shiftcrack/shared';
import { ApiError } from '../lib/errors.js';
import * as gameService from '../services/game.service.js';

/**
 * Thin HTTP adapters (SDD §8.3 step 4.1): parse nothing, apply no business
 * rules — inputs arrive already validated by the zod middleware and the
 * user is resolved by the session guard.
 */

function userIdOf(req: Request): string {
  if (!req.userId) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  return req.userId;
}

export const createSession: RequestHandler = async (req, res) => {
  const session = await gameService.createGameSession(userIdOf(req), req.body as CreateGameSessionInput);
  res.status(201).json(session);
};

export const getSession: RequestHandler = async (req, res) => {
  res.json(await gameService.getGameSession(req.params.id as string, userIdOf(req)));
};

export const submitAttempt: RequestHandler = async (req, res) => {
  const answer = (req.body as { answer: string }).answer;
  res.json(await gameService.submitAttempt(req.params.id as string, userIdOf(req), answer));
};

export const requestHint: RequestHandler = async (req, res) => {
  res.json(await gameService.requestHint(req.params.id as string, userIdOf(req)));
};

export const abandonSession: RequestHandler = async (req, res) => {
  res.json(await gameService.abandonGameSession(req.params.id as string, userIdOf(req)));
};
