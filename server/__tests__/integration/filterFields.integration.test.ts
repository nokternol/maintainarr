import type { AppConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { createApiRouter } from '@server/modules';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
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
  let providerSettingsService: ProviderSettingsService;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    const container = buildContainer({ config: testConfig, db: getDb() });
    providerSettingsService = container.cradle.providerSettingsService;
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 1, email: 'test@example.com' } as unknown as NonNullable<typeof req.user>;
      next();
    });
    app.use('/api', createApiRouter(container.cradle));
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('returns 200 with an empty array when no providers are configured', async () => {
    const res = await supertest(app).get('/api/filter-fields');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns only rules gated by a configured, active provider', async () => {
    await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'test-api-key',
    });

    const res = await supertest(app).get('/api/filter-fields');
    expect(res.status).toBe(200);
    const keys: string[] = res.body.map((f: { key: string }) => f.key);
    // Radarr-sourced rule present
    expect(keys).toContain('title');
    expect(keys).toContain('tagIds');
    // Sonarr-only rule absent — no Sonarr provider configured
    expect(keys).not.toContain('monitored');
  });

  it('excludes rules whose only provider is configured but inactive', async () => {
    await providerSettingsService.create({
      type: MetadataProviderType.SONARR,
      name: 'Inactive Sonarr',
      url: 'http://localhost:8989/api/v3',
      apiKey: 'test-api-key',
      isActive: false,
    });

    const res = await supertest(app).get('/api/filter-fields');
    const keys: string[] = res.body.map((f: { key: string }) => f.key);
    expect(keys).not.toContain('monitored');
  });

  it('returns only movie-compatible fields when contentType=movie', async () => {
    await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'test-api-key',
    });
    await providerSettingsService.create({
      type: MetadataProviderType.SONARR,
      name: 'Test Sonarr',
      url: 'http://localhost:8989/api/v3',
      apiKey: 'test-api-key',
    });

    const res = await supertest(app).get('/api/filter-fields?contentType=movie');
    expect(res.status).toBe(200);
    const keys: string[] = res.body.map((f: { key: string }) => f.key);
    // shared fields present
    expect(keys).toContain('title');
    expect(keys).toContain('hasFile');
    // movie-only present
    expect(keys).toContain('imdbRating');
    // show-only absent
    expect(keys).not.toContain('monitored');
    expect(keys).not.toContain('seriesStatus');
  });

  it('returns only show-compatible fields when contentType=show', async () => {
    await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'test-api-key',
    });
    await providerSettingsService.create({
      type: MetadataProviderType.SONARR,
      name: 'Test Sonarr',
      url: 'http://localhost:8989/api/v3',
      apiKey: 'test-api-key',
    });

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
    expect(keys).not.toContain('imdbRating');
  });

  it('each field is a full MediaRuleDescriptor', async () => {
    await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'test-api-key',
    });

    const res = await supertest(app).get('/api/filter-fields?contentType=movie');
    expect(res.status).toBe(200);
    for (const field of res.body) {
      expect(field.key).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(['boolean', 'number', 'string', 'csv-ids', 'csv-strings', 'range']).toContain(
        field.dataType
      );
      expect(Array.isArray(field.contentTypes)).toBe(true);
      expect(Array.isArray(field.sourceProviders)).toBe(true);
      expect(typeof field.required).toBe('boolean');
      expect(field.predicate).toBeUndefined();
    }
  });

  it('returns 400 for invalid contentType', async () => {
    const res = await supertest(app).get('/api/filter-fields?contentType=invalid');
    expect(res.status).toBe(400);
  });
});
