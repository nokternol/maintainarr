/**
 * POST /api/automations — Session C API integration tests
 * Cycles 9–11: querySources array, cross-type rejection, legacy queryId conversion
 */
import { loadConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { closeDatabase, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { errorHandlerMiddleware } from '@server/middleware/errorHandler';
import { requestIdMiddleware } from '@server/middleware/requestId';
import { createAutomationRoutes } from '@server/modules/automations/automations.routes';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { SavedQueryService } from '@server/services/savedQueryService';
import { createMockConfig } from '@tests/factories';
import { createApiClient } from '@tests/helpers/api';
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('POST /api/automations — Session C', () => {
  let client: ReturnType<typeof createApiClient>;
  let movieProviderId: number;
  let movieQueryId: number;
  let showQueryId: number;

  beforeAll(async () => {
    const mockConfig = createMockConfig({
      NODE_ENV: 'test',
      PORT: 5092,
      DB_PATH: ':memory:',
      DB_LOGGING: false,
    });
    for (const [key, value] of Object.entries(mockConfig)) {
      process.env[key] = String(value);
    }

    const config = loadConfig();
    const db = await initializeDatabase(config);
    const container = buildContainer({ config, db });

    const providerService = new ProviderSettingsService({ db });
    const savedQueryService = new SavedQueryService({ db });

    const provider = await providerService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'test-key',
    });
    movieProviderId = provider.id;

    const movieQuery = await savedQueryService.create({
      name: 'Movie Query',
      contentType: 'movie',
      filterValues: [],
    });
    movieQueryId = movieQuery.id;

    const showQuery = await savedQueryService.create({
      name: 'Show Query',
      contentType: 'show',
      filterValues: [],
    });
    showQueryId = showQuery.id;

    const app: Express = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = { id: 1 };
      next();
    });
    app.use('/api/automations', createAutomationRoutes(container.cradle));
    app.use(errorHandlerMiddleware);

    client = createApiClient(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  // ─── Cycle 9 ────────────────────────────────────────────────────────────────

  it('Cycle 9: querySources array creates automation and returns sources in response', async () => {
    const res = await client.post('/api/automations', {
      name: 'Multi-source automation',
      providerId: movieProviderId,
      taskId: 'radarr.deleteUnmonitored',
      schedule: '0 2 * * *',
      querySources: [{ queryId: movieQueryId, role: 'include', sortOrder: 0 }],
    });

    expect(res.status).toBe(200);
    const data = (res.body as { data: { querySources: unknown[] } }).data;
    expect(data.querySources).toEqual([{ queryId: movieQueryId, role: 'include', sortOrder: 0 }]);
  });

  // ─── Cycle 10 ───────────────────────────────────────────────────────────────

  it('Cycle 10: cross-type querySources (movie + show) returns 400', async () => {
    const res = await client.post('/api/automations', {
      name: 'Cross-type automation',
      providerId: movieProviderId,
      taskId: 'radarr.deleteUnmonitored',
      schedule: '0 2 * * *',
      querySources: [
        { queryId: movieQueryId, role: 'include', sortOrder: 0 },
        { queryId: showQueryId, role: 'exclude', sortOrder: 1 },
      ],
    });

    expect(res.status).toBe(400);
  });

  // ─── Cycle 11 ───────────────────────────────────────────────────────────────

  it('Cycle 11: legacy queryId converts to single include source in response', async () => {
    const res = await client.post('/api/automations', {
      name: 'Legacy automation',
      providerId: movieProviderId,
      taskId: 'radarr.deleteUnmonitored',
      schedule: '0 2 * * *',
      queryId: movieQueryId,
    });

    expect(res.status).toBe(200);
    const data = (res.body as { data: { querySources: unknown[] } }).data;
    expect(data.querySources).toEqual([{ queryId: movieQueryId, role: 'include', sortOrder: 0 }]);
  });
});
