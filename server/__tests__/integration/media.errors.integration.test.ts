/**
 * Tests that provider errors are preserved for all callers:
 * coalesced concurrent requests and cache-hit subsequent requests.
 *
 * Run: vitest run --project server
 */
import { loadConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { closeDatabase, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { errorHandlerMiddleware } from '@server/middleware/errorHandler';
import { requestIdMiddleware } from '@server/middleware/requestId';
import { createMediaRoutes } from '@server/modules/media/media.routes';
import { createMockConfig } from '@tests/factories';
import { createApiClient, expectSuccessResponse } from '@tests/helpers/api';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { server } from '../../../tests/mocks/server';

const MOCK_USER = {
  id: 1,
  email: 'test@example.com',
  plexUsername: 'testuser',
  plexId: null,
  avatar: null,
  userType: 'plex' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildAuthedApp(routes: ReturnType<typeof createMediaRoutes>): Express {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    _req.user = MOCK_USER;
    next();
  });
  app.use('/api/media', routes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('MediaHandler provider error propagation', () => {
  let cradle: ReturnType<typeof buildContainer>['cradle'];

  beforeAll(async () => {
    const mockConfig = createMockConfig({ DB_PATH: ':memory:', DB_LOGGING: false });
    for (const [key, value] of Object.entries(mockConfig)) {
      process.env[key] = String(value);
    }
    const config = loadConfig();
    const db = await initializeDatabase(config);
    const container = buildContainer({ config, db });
    cradle = container.cradle;

    await cradle.providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'fake-key',
    });
    await cradle.providerSettingsService.create({
      type: MetadataProviderType.SONARR,
      name: 'Sonarr',
      url: 'http://localhost:8989/api/v3',
      apiKey: 'fake-key',
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('both concurrent callers receive Radarr errors when requests coalesce', async () => {
    server.use(
      http.get('http://localhost:7878/api/v3/movie', async () => {
        // delay ensures the second request always arrives while the first is in-flight
        await new Promise((resolve) => setTimeout(resolve, 30));
        return new HttpResponse(null, { status: 500 });
      })
    );

    const routes = createMediaRoutes(cradle);
    const client = createApiClient(buildAuthedApp(routes));

    const [res1, res2] = await Promise.all([client.get('/api/media'), client.get('/api/media')]);

    const data1 = expectSuccessResponse(res1);
    const data2 = expectSuccessResponse(res2);

    expect(data1.errors).toHaveLength(1);
    expect(data1.errors[0].provider).toBe('Radarr');

    // The coalesced caller joins the in-flight promise — it must receive the same errors.
    expect(data2.errors).toHaveLength(1);
    expect(data2.errors[0].provider).toBe('Radarr');
  });

  it('cache-hit caller receives errors that were recorded during the original fetch', async () => {
    server.use(
      http.get('http://localhost:7878/api/v3/movie', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const routes = createMediaRoutes(cradle);
    const client = createApiClient(buildAuthedApp(routes));

    const res1 = await client.get('/api/media');
    const data1 = expectSuccessResponse(res1);
    expect(data1.errors).toHaveLength(1);
    expect(data1.errors[0].provider).toBe('Radarr');

    // Second call hits the warm cache — errors must survive the cache round-trip.
    const res2 = await client.get('/api/media');
    const data2 = expectSuccessResponse(res2);
    expect(data2.errors).toHaveLength(1);
    expect(data2.errors[0].provider).toBe('Radarr');
  });

  it('errors are empty when all providers succeed', async () => {
    // Default MSW handlers return success — no override needed.
    const routes = createMediaRoutes(cradle);
    const client = createApiClient(buildAuthedApp(routes));

    const res = await client.get('/api/media');
    const data = expectSuccessResponse(res);

    expect(data.errors).toHaveLength(0);
  });
});
