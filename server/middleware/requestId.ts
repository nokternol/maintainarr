import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns a unique request ID to every incoming request.
 * Respects an existing X-Request-Id header from reverse proxies.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
