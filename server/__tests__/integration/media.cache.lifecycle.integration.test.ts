/**
 * Tests for observable cache lifecycle behaviour in MediaHandler.
 *
 * Two structural bugs are addressed together:
 * 1. Six MediaCache instances live at module scope, shared across every
 *    createMediaHandlers() call — the factory is not referentially transparent.
 * 2. listMedia has its own inline fetch path and never populates the caches
 *    that listMovies / listSeries read from ("split-brain" fetching).
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

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

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

function makeRadarrMovie(title: string, id = 1) {
  return {
    id,
    title,
    hasFile: true,
    monitored: true,
    tmdbId: 603,
    qualityProfileId: 1,
    tags: [],
    path: `/movies/${title}`,
  };
}

// --------------------------------------------------------------------------

describe('MediaHandler cache lifecycle', () => {
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

  it('GET /api/media warms the movies cache so GET /api/media/movies does not re-fetch from Radarr', async () => {
    // Arrange: first Radarr call succeeds; subsequent calls return 503 so any
    // re-fetch is detectable via an empty items array.
    let radarrCallCount = 0;
    server.use(
      http.get('http://localhost:7878/api/v3/movie', () => {
        radarrCallCount++;
        if (radarrCallCount > 1) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json([makeRadarrMovie('The Matrix')]);
      })
    );

    const routes = createMediaRoutes(cradle);
    const client = createApiClient(buildAuthedApp(routes));

    await client.get('/api/media'); // must warm the cache

    const res = await client.get('/api/media/movies');
    const data = expectSuccessResponse(res);

    // If cache was warmed, the movies endpoint reads it and Radarr is not called again.
    expect(radarrCallCount).toBe(1);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('The Matrix');
  });

  it('two createMediaHandlers() instances have independent caches', async () => {
    // Arrange: each successive Radarr call returns a different film title so we
    // can detect whether handler B read from handler A's cache or fetched independently.
    let radarrCallCount = 0;
    server.use(
      http.get('http://localhost:7878/api/v3/movie', () => {
        radarrCallCount++;
        const title = radarrCallCount === 1 ? 'The Matrix' : 'Inception';
        return HttpResponse.json([makeRadarrMovie(title, radarrCallCount)]);
      })
    );

    const routesA = createMediaRoutes(cradle);
    const routesB = createMediaRoutes(cradle);
    const clientA = createApiClient(buildAuthedApp(routesA));
    const clientB = createApiClient(buildAuthedApp(routesB));

    const resA = await clientA.get('/api/media/movies');
    expect(expectSuccessResponse(resA).items[0].title).toBe('The Matrix');
    expect(radarrCallCount).toBe(1);

    // Handler B must NOT read from handler A's cache; it must do its own fetch.
    const resB = await clientB.get('/api/media/movies');
    expect(expectSuccessResponse(resB).items[0].title).toBe('Inception');
    expect(radarrCallCount).toBe(2);
  });
});
