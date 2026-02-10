import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestIdMiddleware } from '../../middleware';

function createApp() {
  const app = express();
  app.use(requestIdMiddleware);
  app.get('/test', (req, res) => {
    res.json({ requestId: req.requestId });
  });
  return app;
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when no X-Request-Id header is present', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('uses the X-Request-Id header when provided', async () => {
    const app = createApp();
    const res = await request(app).get('/test').set('X-Request-Id', 'custom-id-123');

    expect(res.body.requestId).toBe('custom-id-123');
  });

  it('sets the X-Request-Id response header', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });
});
