import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError, NotFoundError, ValidationError } from '../../errors';
import { errorHandlerMiddleware, requestIdMiddleware } from '../../middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  return app;
}

function withErrorHandler(app: express.Express) {
  app.use(errorHandlerMiddleware);
  return app;
}

describe('errorHandlerMiddleware', () => {
  it('handles NotFoundError with 404 and structured response', async () => {
    const app = createApp();
    app.get('/test', (_req, _res, next) => {
      next(new NotFoundError('User not found'));
    });
    withErrorHandler(app);

    const res = await request(app).get('/test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      status: 'error',
      error: {
        type: 'NOT_FOUND',
        message: 'User not found',
      },
    });
  });

  it('handles ValidationError with field errors', async () => {
    const app = createApp();
    app.get('/test', (_req, _res, next) => {
      next(new ValidationError('Bad input', { email: ['Required'] }));
    });
    withErrorHandler(app);

    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual({ email: ['Required'] });
  });

  it('handles generic AppError', async () => {
    const app = createApp();
    app.get('/test', (_req, _res, next) => {
      next(new AppError('Service unavailable', 503, 'SERVICE_UNAVAILABLE'));
    });
    withErrorHandler(app);

    const res = await request(app).get('/test');

    expect(res.status).toBe(503);
    expect(res.body.error.type).toBe('SERVICE_UNAVAILABLE');
  });

  it('handles unknown errors with 500', async () => {
    const app = createApp();
    app.get('/test', () => {
      throw new Error('something unexpected');
    });
    withErrorHandler(app);

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.type).toBe('INTERNAL_ERROR');
  });

  it('includes request ID in response headers', async () => {
    const app = createApp();
    app.get('/test', (_req, _res, next) => {
      next(new NotFoundError());
    });
    withErrorHandler(app);

    const res = await request(app).get('/test').set('X-Request-Id', 'trace-abc');

    expect(res.headers['x-request-id']).toBe('trace-abc');
    expect(res.status).toBe(404);
  });
});
