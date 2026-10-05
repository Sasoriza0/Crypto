import { Router } from 'express';
import * as sessionController from '../controllers/session.controller.js';
import { attachSession } from '../middleware/session.js';

/**
 * Session heartbeat routes, mounted under /api/v1/session. The ping keeps
 * the httpOnly cookie and the server-side Session row (plus the user's
 * ACTIVE game sessions) alive while the player works locally on a cipher.
 */
export const sessionRouter = Router();

sessionRouter.get('/ping', attachSession, sessionController.ping);
