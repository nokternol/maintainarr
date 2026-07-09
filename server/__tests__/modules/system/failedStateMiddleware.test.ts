import { failedStateMiddleware } from '@server/modules/system/failedStateMiddleware';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

function buildApp(reason: string): Express {
  const app = express();
  app.use(failedStateMiddleware(reason));
  return app;
}

describe('failedStateMiddleware', () => {
  it('intercepts all routes and returns an HTML error page', async () => {
    const app = buildApp('Database initialisation failed');

    const res = await request(app).get('/any/path');

    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Database initialisation failed');
  });

  it('works for any HTTP method', async () => {
    const app = buildApp('Critical failure');

    const res = await request(app).post('/api/automations');

    expect(res.status).toBe(503);
    expect(res.text).toContain('Critical failure');
  });
});
