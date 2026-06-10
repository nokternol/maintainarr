import { loadConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { closeDatabase, initializeDatabase } from '@server/database';
import { errorHandlerMiddleware } from '@server/middleware/errorHandler';
import { requestIdMiddleware } from '@server/middleware/requestId';
import { createSavedQueryRoutes } from '@server/modules/savedQueries/savedQueries.routes';
import { SavedQueryService } from '@server/services/savedQueryService';
import { createMockConfig } from '@tests/factories';
import { createApiClient, expectErrorResponse, expectSuccessResponse } from '@tests/helpers/api';
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('GET /api/saved-queries/:id/preview', () => {
  let client: ReturnType<typeof createApiClient>;
  let seededQueryId: number;

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

    const app: Express = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = { id: 1 };
      next();
    });
    app.use('/api/saved-queries', createSavedQueryRoutes(container.cradle));
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
});
