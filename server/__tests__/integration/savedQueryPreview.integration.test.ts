import { loadConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { closeDatabase, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { errorHandlerMiddleware } from '@server/middleware/errorHandler';
import { requestIdMiddleware } from '@server/middleware/requestId';
import { createMediaQueryRoutes } from '@server/modules/mediaQueries/mediaQueries.routes';
import { SavedQueryService } from '@server/services/savedMediaQueryService';
import { createMockConfig } from '@tests/factories';
import { createRadarrMovie } from '@tests/factories';
import { createApiClient, expectErrorResponse, expectSuccessResponse } from '@tests/helpers/api';
import { server } from '@tests/mocks/server';
import express, { type Express } from 'express';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RADARR_URL = 'http://localhost:7878';

describe('GET /api/saved-queries/:id/preview', () => {
  let client: ReturnType<typeof createApiClient>;
  let seededQueryId: number;
  let filteredQueryId: number;

  beforeAll(async () => {
    const mockConfig = createMockConfig({
      NODE_ENV: 'test',
      PORT: 5093,
      DB_PATH: ':memory:',
      DB_LOGGING: false,
    });
    for (const [key, value] of Object.entries(mockConfig)) {
      process.env[key] = String(value);
    }

    const config = loadConfig();
    const db = await initializeDatabase(config);
    const container = buildContainer({ config, db });

    const savedQueryService = new SavedQueryService({ db });
    const query = await savedQueryService.create({
      name: 'Preview Query',
      contentType: 'movie',
      filterValues: [],
    });
    seededQueryId = query.id;

    const filtered = await savedQueryService.create({
      name: 'Downloaded Movies',
      contentType: 'movie',
      filterValues: [{ key: 'hasFile', value: true }],
    });
    filteredQueryId = filtered.id;

    await container.cradle.providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Radarr',
      url: `${RADARR_URL}/api/v3`,
      apiKey: 'test-api-key',
    });

    const app: Express = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use((req, _res, next) => {
      req.user = { id: 1 } as unknown as NonNullable<typeof req.user>;
      next();
    });
    app.use('/api/saved-queries', createMediaQueryRoutes(container.cradle));
    app.use(errorHandlerMiddleware);

    client = createApiClient(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('returns { count: number } for a known query id', async () => {
    const res = await client.get(`/api/saved-queries/${seededQueryId}/preview`);
    const data = expectSuccessResponse(res);
    expect(data).toMatchObject({ count: expect.any(Number) });
  });

  it('returns 404 for an unknown query id', async () => {
    const res = await client.get('/api/saved-queries/9999/preview');
    expectErrorResponse(res, 404);
  });

  it('returns the engine match count for the query against the active provider', async () => {
    server.use(
      http.get(`${RADARR_URL}/api/v3/movie`, () =>
        HttpResponse.json([
          createRadarrMovie({ id: 1, title: 'Downloaded', hasFile: true }),
          createRadarrMovie({ id: 2, title: 'Missing', hasFile: false }),
        ])
      )
    );

    const res = await client.get(`/api/saved-queries/${filteredQueryId}/preview`);
    const data = expectSuccessResponse(res);
    expect(data).toEqual({ count: 1 });
  });
});
