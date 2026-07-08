import type { NextFunction, Request, Response } from 'express';
import { getChildLogger } from '../logger';

const log = getChildLogger('HTTP');

/**
 * Logs every request after the response is sent.
 * Captures method, path, status code, duration, and request ID.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(3)}ms`,
    };

    if (res.statusCode >= 500) {
      log.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      log.warn('Client error', logData);
    } else {
      log.info('Request completed', logData);
    }
  });

  next();
}
