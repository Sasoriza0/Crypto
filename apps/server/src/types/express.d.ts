declare global {
  namespace Express {
    interface Request {
      /** Authenticated user id, set by the session middleware. */
      userId?: string;
      /** Current session id (cookie), set by the session middleware. */
      sessionId?: string;
    }
  }
}

export {};
