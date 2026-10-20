import { Router } from 'express';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@shiftcrack/shared';
import * as authController from '../controllers/auth.controller.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiters.js';
import { attachSession } from '../middleware/session.js';
import { validate } from '../middleware/validate.js';

/**
 * Auth routes (SDD §4), mounted under /api/v1/auth. Credential endpoints
 * carry the strict per-IP auth limiter; /me and /logout resolve the session
 * cookie through the same guard used by the game routes. Password reset
 * endpoints get their own strictest limiter (outbound email + token
 * brute-force surface).
 */
export const authRouter = Router();

authRouter.post('/anonymous', authLimiter, authController.anonymous);
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login);
authRouter.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), authController.resetPassword);
authRouter.get('/me', attachSession, authController.me);
authRouter.post('/logout', attachSession, authController.logout);
