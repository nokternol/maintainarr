import type { NextFunction, Request, Response } from 'express';
import { AppError, ValidationError } from '../errors';
import { getChildLogger } from '../logger';
import type { ApiErrorResponse } from '../types/api';

const log = getChildLogger('ErrorHandler');

/**
 * Global error handling middleware. Must be registered LAST in the middleware chain.
 *
 * - AppError subclasses → structured JSON with the appropriate status code
 * - Unknown errors → 500 with generic message in production, real message in dev
 * - Every error is logged with the request ID for tracing
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      status: 'error',
      error: {
        type: err.type,
        message: err.message,
        ...(err instanceof ValidationError && { errors: err.errors }),
      },
    };

    if (err.statusCode >= 500) {
      log.error(err.message, { requestId: req.requestId, stack: err.stack });
    } else {
      log.warn(err.message, { requestId: req.requestId, type: err.type });
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown / programming errors
  log.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
  });

  const response: ApiErrorResponse = {
    status: 'error',
    error: {
      type: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    },
  };

  res.status(500).json(response);
}
