import { Router } from 'express';
import { loginSchema, registerSchema } from '@shiftcrack/shared';
import * as authController from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { attachSession } from '../middleware/session.js';
import { validate } from '../middleware/validate.js';

/**
 * Auth routes (SDD §4), mounted under /api/v1/auth. Credential endpoints
 * carry the strict per-IP auth limiter; /me and /logout resolve the session
 * cookie through the same guard used by the game routes.
 */
export const authRouter = Router();

authRouter.post('/anonymous', authLimiter, authController.anonymous);
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login);
authRouter.get('/me', attachSession, authController.me);
authRouter.post('/logout', attachSession, authController.logout);
