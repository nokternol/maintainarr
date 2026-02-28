import type { NextFunction, Request, Response } from 'express';
import type { User } from '../database/schema';
import { UnauthorizedError } from '../errors';
import { getChildLogger } from '../logger';

const log = getChildLogger('AuthMiddleware');

declare module 'express-session' {
  interface SessionData {
    userId: number; //plexId?
  }
}

// Extend Express types
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Attaches user to request if session exists (non-blocking).
 * Use before routes to make req.user available.
 */
export async function checkUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.session?.userId) {
      const { authService } = req.scope.cradle;
      const user = await authService.getUserById(req.session.userId);
      req.user = user;
      log.debug('User attached to request', {
        userId: user.id,
        requestId: req.requestId,
      });
    }
    next();
  } catch {
    // User not found - clear invalid session
    if (req.session) {
      req.session.userId = undefined;
    }
    next();
  }
}

/**
 * Guard middleware - requires authentication.
 * Throws 401 if no user attached.
 */
export function isAuthenticated() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      log.warn('Unauthenticated request', {
        requestId: req.requestId,
        path: req.path,
      });
      throw new UnauthorizedError('Authentication required');
    }
    next();
  };
}
