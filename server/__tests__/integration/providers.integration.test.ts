import 'reflect-metadata';
import { loadConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { closeDatabase, initializeDatabase } from '@server/database';
import { errorHandlerMiddleware } from '@server/middleware/errorHandler';
import { requestIdMiddleware } from '@server/middleware/requestId';
import { createProvidersRoutes } from '@server/modules/providers/providers.routes';
import { createMockConfig } from '@tests/factories';
import { createApiClient, expectErrorResponse, expectSuccessResponse } from '@tests/helpers/api';
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Providers API Integration', () => {
  let app: Express;
  let client: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    const mockConfig = createMockConfig({
      NODE_ENV: 'test',
      PORT: 5057,
      DB_PATH: ':memory:',
      DB_LOGGING: false,
    });

    for (const [key, value] of Object.entries(mockConfig)) {
      process.env[key] = String(value);
    }

    const config = loadConfig();
    const dataSource = await initializeDatabase(config);
    const container = buildContainer({ config, dataSource });

    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use('/api/providers', createProvidersRoutes(container.cradle));
    app.use(errorHandlerMiddleware);

    client = createApiClient(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/providers/metadata', () => {
    it('returns Sonarr metadata when given valid SONARR params', async () => {
      const response = await client.get(
        '/api/providers/metadata?type=SONARR&url=http://localhost:8989/api/v3&apiKey=fake-api-key'
      );
      const data = expectSuccessResponse(response);

      expect(data.type).toBe('SONARR');
      expect(data.data).toHaveProperty('series');
      expect(data.data).toHaveProperty('qualityProfiles');
      expect(data.data).toHaveProperty('rootFolders');
      expect(data.data).toHaveProperty('tags');
      expect(data.data.series[0].title).toBe('Breaking Bad');
    });

    it('returns Radarr metadata when given valid RADARR params', async () => {
      const response = await client.get(
        '/api/providers/metadata?type=RADARR&url=http://localhost:7878/api/v3&apiKey=fake-api-key'
      );
      const data = expectSuccessResponse(response);

      expect(data.type).toBe('RADARR');
      expect(data.data).toHaveProperty('movies');
      expect(data.data).toHaveProperty('qualityProfiles');
      expect(data.data).toHaveProperty('rootFolders');
      expect(data.data).toHaveProperty('tags');
    });

    it('returns Plex metadata when given valid PLEX params', async () => {
      const response = await client.get(
        '/api/providers/metadata?type=PLEX&url=http://localhost:32400&apiKey=fake-plex-token'
      );
      const data = expectSuccessResponse(response);

      expect(data.type).toBe('PLEX');
      expect(data.data).toHaveProperty('libraries');
      expect(data.data.libraries[0].title).toBe('Movies');
    });

    it('returns Jellyfin metadata when given valid JELLYFIN params', async () => {
      const response = await client.get(
        '/api/providers/metadata?type=JELLYFIN&url=http://localhost:8096&apiKey=fake-api-key&settings=%7B%22userId%22%3A%22user-id-123%22%7D'
      );
      const data = expectSuccessResponse(response);

      expect(data.type).toBe('JELLYFIN');
      expect(data.data).toHaveProperty('libraries');
    });

    it('returns Tautulli metadata when given valid TAUTULLI params', async () => {
      const response = await client.get(
        '/api/providers/metadata?type=TAUTULLI&url=http://localhost:8181&apiKey=fake-api-key'
      );
      const data = expectSuccessResponse(response);

      expect(data.type).toBe('TAUTULLI');
      expect(data.data).toHaveProperty('libraryStats');
      expect(data.data).toHaveProperty('homeStats');
      expect(data.data).toHaveProperty('recentHistory');
    });

    it('returns Overseerr metadata when given valid OVERSEERR params', async () => {
      const response = await client.get(
        '/api/providers/metadata?type=OVERSEERR&url=http://localhost:5055&apiKey=fake-api-key'
      );
      const data = expectSuccessResponse(response);

      expect(data.type).toBe('OVERSEERR');
      expect(data.data).toHaveProperty('requests');
    });

    it('returns 400 when type is missing', async () => {
      const response = await client.get(
        '/api/providers/metadata?url=http://localhost:8989&apiKey=key'
      );
      expectErrorResponse(response, 400);
    });

    it('returns 400 when url is missing', async () => {
      const response = await client.get('/api/providers/metadata?type=SONARR&apiKey=key');
      expectErrorResponse(response, 400);
    });
  });
});
