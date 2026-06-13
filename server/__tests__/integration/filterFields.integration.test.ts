import type { AppConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { createApiRouter } from '@server/modules';
import express from 'express';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 5057,
  COMMIT_TAG: 'test',
  LOG_LEVEL: 'error',
  LOG_DIR: './config/logs',
  DB_PATH: ':memory:',
  DB_LOGGING: false,
  TRUST_PROXY: false,
  TMDB_API_KEY: '',
  SESSION_SECRET: 'test-secret',
};

describe('GET /api/filter-fields', () => {
  let app: express.Express;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    const container = buildContainer({ config: testConfig, db: getDb() });
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 1, email: 'test@example.com' };
      next();
    });
    app.use('/api', createApiRouter(container.cradle));
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('returns 200 with all filter fields when no contentType given', async () => {
    const res = await supertest(app).get('/api/filter-fields');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns only movie-compatible fields when contentType=movie', async () => {
    const res = await supertest(app).get('/api/filter-fields?contentType=movie');
    expect(res.status).toBe(200);
    const keys: string[] = res.body.map((f: { key: string }) => f.key);
    // shared fields present
    expect(keys).toContain('title');
    expect(keys).toContain('hasFile');
    // movie-only present
    expect(keys).toContain('imdbRatingGte');
    // show-only absent
    expect(keys).not.toContain('monitored');
    expect(keys).not.toContain('seriesStatus');
  });

  it('returns only show-compatible fields when contentType=show', async () => {
    const res = await supertest(app).get('/api/filter-fields?contentType=show');
    expect(res.status).toBe(200);
    const keys: string[] = res.body.map((f: { key: string }) => f.key);
    // shared fields present
    expect(keys).toContain('title');
    expect(keys).toContain('hasFile');
    // show-only present
    expect(keys).toContain('monitored');
    expect(keys).toContain('seriesStatus');
    // movie-only absent
    expect(keys).not.toContain('imdbRatingGte');
  });

  it('each field has key, label, dataType, and contentTypes', async () => {
    const res = await supertest(app).get('/api/filter-fields?contentType=movie');
    expect(res.status).toBe(200);
    for (const field of res.body) {
      expect(field.key).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(['boolean', 'number', 'string', 'csv-ids', 'csv-strings']).toContain(field.dataType);
      expect(Array.isArray(field.contentTypes)).toBe(true);
    }
  });

  it('returns 400 for invalid contentType', async () => {
    const res = await supertest(app).get('/api/filter-fields?contentType=invalid');
    expect(res.status).toBe(400);
  });
});
