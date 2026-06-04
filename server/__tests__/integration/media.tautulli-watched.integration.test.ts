/**
 * Integration test — Tautulli watched-titles cache
 *
 * Verifies that fetchWatchedTitles() only calls the Tautulli get_history
 * endpoint once across multiple listMovies requests (second request hits cache).
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
import { server } from '@tests/mocks/server';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

describe('fetchWatchedTitles caching', () => {
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
      type: MetadataProviderType.TAUTULLI,
      name: 'Tautulli',
      url: 'http://localhost:8181',
      apiKey: 'fake-key',
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('calls Tautulli get_history exactly once across two identical listMovies requests', async () => {
    let getHistoryCallCount = 0;

    server.use(
      http.get('http://localhost:7878/api/v3/movie', () =>
        HttpResponse.json([
          {
            id: 1,
            title: 'The Matrix',
            year: 1999,
            hasFile: true,
            monitored: true,
            tmdbId: 603,
            qualityProfileId: 1,
            tags: [],
            path: '/movies/The Matrix',
          },
        ])
      ),
      http.get('http://localhost:8181/api/v2', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('cmd') === 'get_history') {
          getHistoryCallCount++;
        }
        return HttpResponse.json({
          response: {
            result: 'success',
            data: {
              data: [
                {
                  rating_key: '1',
                  title: 'The Matrix',
                  user: 'testuser',
                  watched_status: 1,
                  duration: 100,
                  play_duration: 100,
                },
              ],
              total_count: 1,
            },
          },
        });
      })
    );

    const routes = createMediaRoutes(cradle);
    const client = createApiClient(buildAuthedApp(routes));

    const res1 = await client.get('/api/media/movies?tautulliWatched=true');
    const res2 = await client.get('/api/media/movies?tautulliWatched=true');

    expectSuccessResponse(res1);
    expectSuccessResponse(res2);

    expect(getHistoryCallCount).toBe(1);
  });
});
