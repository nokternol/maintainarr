/**
 * AutomationExecutor + AutomationRunService integration test.
 *
 * Verifies that each executor.execute() call creates a row in automation_runs.
 * Uses real DB and MSW for HTTP interception.
 *
 * Run: vitest run --project server
 */
import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { AutomationExecutor } from '@server/services/automationExecutor';
import { AutomationRunService } from '@server/services/automationRunService';
import { AutomationService } from '@server/services/automationService';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { SavedQueryService } from '@server/services/savedQueryService';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRadarrMovie } from '../../../tests/factories';
import { server } from '../../../tests/mocks/server';

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 5057,
  COMMIT_TAG: 'test',
  LOG_LEVEL: 'error',
  LOG_DIR: './config/logs',
  DB_PATH: ':memory:',
  DB_LOGGING: false,
  TRUST_PROXY: false,
  TMDB_API_KEY: '',
  SESSION_SECRET: 'test-secret',
};

const RADARR_URL = 'http://localhost:7878';

describe('AutomationExecutor writes to automation_runs', () => {
  let automationService: AutomationService;
  let automationRunService: AutomationRunService;
  let providerSettingsService: ProviderSettingsService;
  let savedQueryService: SavedQueryService;
  let executor: AutomationExecutor;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    const db = getDb();
    automationService = new AutomationService({ db });
    automationRunService = new AutomationRunService({ db });
    providerSettingsService = new ProviderSettingsService({ db });
    savedQueryService = new SavedQueryService({ db });
    executor = new AutomationExecutor({
      automationService,
      automationRunService,
      providerSettingsService,
    });
  });

  afterEach(async () => {
    await _resetDatabase();
    server.resetHandlers();
  });

  it('creates an automation_run row with status=success after a successful execution', async () => {
    const movies = [createRadarrMovie({ id: 1, title: 'The Matrix', year: 1999, hasFile: true })];
    server.use(
      http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
      http.put(`${RADARR_URL}/api/v3/movie/:id`, () =>
        HttpResponse.json({ id: 1, monitored: false })
      )
    );

    const provider = await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: `${RADARR_URL}/api/v3`,
      apiKey: 'test-key',
    });
    const query = await savedQueryService.create({ name: 'Q', filters: {}, mediaType: 'movie' });
    const automation = await automationService.create({
      name: 'Nightly',
      queryId: query.id,
      providerId: provider.id,
      taskId: 'unmonitorMovie',
      schedule: '0 2 * * *',
    });

    await executor.execute(automation.id);

    const runs = await automationRunService.listRuns({ automationId: automation.id });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('success');
    expect(runs[0].itemCount).toBe(1);
    expect(runs[0].automationName).toBe('Nightly');
  });

  it('creates an automation_run row with status=error after a failed execution', async () => {
    server.use(
      http.get(`${RADARR_URL}/api/v3/movie`, () => new HttpResponse(null, { status: 500 }))
    );

    const provider = await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: `${RADARR_URL}/api/v3`,
      apiKey: 'test-key',
    });
    const query = await savedQueryService.create({ name: 'Q', filters: {}, mediaType: 'movie' });
    const automation = await automationService.create({
      name: 'Nightly',
      queryId: query.id,
      providerId: provider.id,
      taskId: 'unmonitorMovie',
      schedule: '0 2 * * *',
    });

    await executor.execute(automation.id);

    const runs = await automationRunService.listRuns({ automationId: automation.id });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('error');
    expect(runs[0].error).toBeTruthy();
  });
});
