/**
 * Source ownership projection — GET /api/media/sources.
 *
 * The client must derive "which provider owns this content type, and is it
 * configured" from this projection, never from its own literal RADARR/SONARR
 * checks. The single authority is `OWNER_TYPE` in mediaSourceFactory.
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
import express, { type Express } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const mockUser = {
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

describe('GET /api/media/sources — ownership projection', () => {
  let client: ReturnType<typeof createApiClient>;

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
    // Radarr configured and active; no Sonarr instance exists.
    await container.cradle.providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'fake-key',
    });

    const app: Express = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = mockUser;
      next();
    });
    app.use('/api/media', createMediaRoutes(container.cradle));
    app.use(errorHandlerMiddleware);
    client = createApiClient(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('projects each content type with its owner type and configured state', async () => {
    const res = await client.get('/api/media/sources');
    const data = expectSuccessResponse(res);

    expect(data).toEqual([
      { contentType: 'movie', ownerType: 'RADARR', configured: true },
      { contentType: 'show', ownerType: 'SONARR', configured: false },
    ]);
  });
});
