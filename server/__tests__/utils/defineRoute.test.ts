import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandlerMiddleware, requestIdMiddleware } from '../../middleware';
import { defineRoute } from '../../utils/defineRoute';

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

describe('defineRoute', () => {
  it('wraps handler result in ApiSuccessResponse envelope', async () => {
    const app = createApp();
    app.get(
      '/test',
      defineRoute({
        handler: async () => ({ message: 'hello' }),
      })
    );

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      data: { message: 'hello' },
    });
  });

  it('validates request body and rejects invalid input', async () => {
    const app = createApp();
    app.post(
      '/test',
      defineRoute({
        schemas: {
          body: z.object({
            name: z.string(),
            age: z.number(),
          }),
        },
        handler: async ({ body }) => body,
      })
    );
    withErrorHandler(app);

    const res = await request(app).post('/test').send({ name: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toBeDefined();
  });

  it('validates request body and passes valid input to handler', async () => {
    const app = createApp();
    app.post(
      '/test',
      defineRoute({
        schemas: {
          body: z.object({
            name: z.string(),
          }),
        },
        handler: async ({ body }) => ({ received: body.name }),
      })
    );

    const res = await request(app).post('/test').send({ name: 'Alice' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ received: 'Alice' });
  });

  it('validates query parameters', async () => {
    const app = createApp();
    app.get(
      '/test',
      defineRoute({
        schemas: {
          query: z.object({
            page: z.coerce.number().int().min(1),
          }),
        },
        handler: async ({ query }) => ({ page: query.page }),
      })
    );
    withErrorHandler(app);

    const res = await request(app).get('/test?page=abc');

    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
  });

  it('forwards handler errors to Express error middleware', async () => {
    const app = createApp();
    app.get(
      '/test',
      defineRoute({
        handler: async () => {
          throw new Error('handler exploded');
        },
      })
    );
    withErrorHandler(app);

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error.type).toBe('INTERNAL_ERROR');
  });

  it('provides requestId in handler context', async () => {
    const app = createApp();
    app.get(
      '/test',
      defineRoute({
        handler: async ({ requestId }) => ({ requestId }),
      })
    );

    const res = await request(app).get('/test').set('X-Request-Id', 'trace-xyz');

    expect(res.body.data.requestId).toBe('trace-xyz');
  });
});
