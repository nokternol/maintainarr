/**
 * Automation Runs API Integration Tests
 *
 * Tests GET /api/automations/runs via the real automations router.
 * Auth is bypassed by injecting a fake session middleware before mounting.
 *
 * Run: vitest run --project server
 */
import { loadConfig } from '@server/config';
import { buildContainer } from '@server/container';
import { closeDatabase, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { errorHandlerMiddleware } from '@server/middleware/errorHandler';
import { requestIdMiddleware } from '@server/middleware/requestId';
import { createAutomationRoutes } from '@server/modules/automations/automations.routes';
import type { AutomationRunService } from '@server/services/automationRunService';
import { AutomationService } from '@server/services/automationService';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { SavedQueryService } from '@server/services/savedQueryService';
import { createMockConfig } from '@tests/factories';
import { createApiClient } from '@tests/helpers/api';
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('GET /api/automations/runs', () => {
  let app: Express;
  let client: ReturnType<typeof createApiClient>;
  let runService: AutomationRunService;
  let automationId: number;

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
    const db = await initializeDatabase(config);
    const container = buildContainer({ config, db });

    // Seed fixtures
    const providerService = new ProviderSettingsService({ db });
    const savedQueryService = new SavedQueryService({ db });
    const automationService = new AutomationService({ db });

    const provider = await providerService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: 'http://localhost:7878/api/v3',
      apiKey: 'test-key',
    });
    const query = await savedQueryService.create({
      name: 'Test Query',
      contentType: 'movie',
      filterValues: [],
    });
    const automation = await automationService.create({
      name: 'Nightly Cleanup',
      querySources: [{ queryId: query.id, role: 'include' }],
      providerId: provider.id,
      taskId: 'unmonitorMovie',
      schedule: '0 2 * * *',
    });
    automationId = automation.id;
    runService = container.cradle.automationRunService;

    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    // Inject a fake user so isAuthenticated() passes
    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = { id: 1, email: 'test@example.com' };
      next();
    });
    app.use('/api/automations', createAutomationRoutes(container.cradle));
    app.use(errorHandlerMiddleware);

    client = createApiClient(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('returns empty data array when no runs exist', async () => {
    const res = await client.get('/api/automations/runs');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data.data).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('returns runs with correct shape', async () => {
    await runService.createRun({ automationId, status: 'success', itemCount: 5 });

    const res = await client.get('/api/automations/runs');
    expect(res.status).toBe(200);
    const { data } = res.body.data;
    expect(data[0]).toMatchObject({
      automationId,
      automationName: 'Nightly Cleanup',
      status: 'success',
      itemCount: 5,
    });
  });

  it('filters by automationId query param', async () => {
    const res = await client.get(`/api/automations/runs?automationId=${automationId}`);
    expect(res.status).toBe(200);
    const { data } = res.body.data;
    for (const r of data) {
      expect(r.automationId).toBe(automationId);
    }
  });

  it('respects limit query param', async () => {
    await runService.createRun({ automationId, status: 'success' });
    await runService.createRun({ automationId, status: 'error' });

    const res = await client.get('/api/automations/runs?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
  });
});
