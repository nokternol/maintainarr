/**
 * Media API integration tests.
 *
 * /api/media requires authentication and returns movies + series from
 * all active Radarr/Sonarr providers saved in the DB.
 * External HTTP calls are intercepted by MSW (see tests/mocks).
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
import { createApiClient, expectErrorResponse, expectSuccessResponse } from '@tests/helpers/api';
import express, { type Express } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Media API Integration', () => {
  let authedApp: Express;
  let unauthedApp: Express;
  let authedClient: ReturnType<typeof createApiClient>;
  let unauthedClient: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    const mockConfig = createMockConfig({
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      DB_LOGGING: false,
    });

    for (const [key, value] of Object.entries(mockConfig)) {
      process.env[key] = String(value);
    }

    const config = loadConfig();
    const db = await initializeDatabase(config);
    const container = buildContainer({ config, db });
    const { providerSettingsService } = container.cradle;

    // Seed active Radarr and Sonarr providers
    await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'fake-key',
    });
    await providerSettingsService.create({
      type: MetadataProviderType.SONARR,
      name: 'Sonarr',
      url: 'http://localhost:8989/api/v3',
      apiKey: 'fake-key',
    });

    const mediaRoutes = createMediaRoutes(container.cradle);

    authedApp = express();
    authedApp.use(express.json());
    authedApp.use(requestIdMiddleware);
    authedApp.use((_req: Request, _res: Response, next: NextFunction) => {
      _req.user = {
        id: 1,
        email: 'test@example.com',
        plexUsername: 'testuser',
        plexId: null,
        avatar: null,
        userType: 'plex',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      next();
    });
    authedApp.use('/api/media', mediaRoutes);
    authedApp.use(errorHandlerMiddleware);

    unauthedApp = express();
    unauthedApp.use(express.json());
    unauthedApp.use(requestIdMiddleware);
    unauthedApp.use('/api/media', mediaRoutes);
    unauthedApp.use(errorHandlerMiddleware);

    authedClient = createApiClient(authedApp);
    unauthedClient = createApiClient(unauthedApp);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('GET /media returns 401 when unauthenticated', async () => {
    const res = await unauthedClient.get('/api/media');
    expectErrorResponse(res, 401);
  });

  it('GET /media returns movies and series from all active providers', async () => {
    const res = await authedClient.get('/api/media');
    const data = expectSuccessResponse(res);

    expect(data).toHaveProperty('movies');
    expect(data).toHaveProperty('series');
    expect(data).toHaveProperty('errors');

    expect(Array.isArray(data.movies)).toBe(true);
    expect(Array.isArray(data.series)).toBe(true);
    expect(Array.isArray(data.errors)).toBe(true);

    // MSW returns The Matrix from Radarr
    expect(data.movies[0]).toMatchObject({ title: 'The Matrix' });
    // MSW returns Breaking Bad from Sonarr
    expect(data.series[0]).toMatchObject({ title: 'Breaking Bad' });
    // No failures with mocked providers
    expect(data.errors).toHaveLength(0);
  });

  it('GET /media response has expected shape', async () => {
    const res = await authedClient.get('/api/media');
    const data = expectSuccessResponse(res);

    // Shape checks
    expect(typeof data.movies).toBe('object');
    expect(typeof data.series).toBe('object');
    expect(typeof data.errors).toBe('object');
    // At least the seeded providers returned data
    expect(data.movies.length).toBeGreaterThan(0);
    expect(data.series.length).toBeGreaterThan(0);
  });
});
