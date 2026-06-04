/**
 * AutomationService tests — date field type safety.
 *
 * Confirms that `createdAt` and `updatedAt` in AutomationDto are valid ISO 8601
 * strings produced directly from the custom datetime column's Date output,
 * without requiring a double-cast.
 *
 * Uses a real in-memory SQLite database so the column's fromDriver
 * converter runs end-to-end.
 *
 * Run: yarn vitest run --project server
 */
import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { AutomationService } from '@server/services/automationService';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { SavedQueryService } from '@server/services/savedQueryService';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 5057,
  COMMIT_TAG: 'test',
  LOG_LEVEL: 'error',
  LOG_DIR: './config/logs',
  DB_PATH: ':memory:',
  DB_LOGGING: false,
  TRUST_PROXY: false,
  TMDB_API_KEY: 'test-tmdb-key',
  SESSION_SECRET: 'test-session-secret',
};

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

async function seedProvider(providerService: ProviderSettingsService) {
  return providerService.create({
    type: MetadataProviderType.RADARR,
    name: 'Test Radarr',
    url: 'http://localhost:7878/api/v3',
    apiKey: 'test-key',
  });
}

async function seedQuery(queryService: SavedQueryService) {
  return queryService.create({ name: 'Test Query', filters: {} });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutomationService', () => {
  let automationService: AutomationService;
  let providerSettingsService: ProviderSettingsService;
  let savedQueryService: SavedQueryService;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    const db = getDb();
    automationService = new AutomationService({ db });
    providerSettingsService = new ProviderSettingsService({ db });
    savedQueryService = new SavedQueryService({ db });
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  describe('create', () => {
    it('returns createdAt and updatedAt as valid ISO 8601 strings', async () => {
      const provider = await seedProvider(providerSettingsService);
      const query = await seedQuery(savedQueryService);

      const dto = await automationService.create({
        name: 'My Automation',
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });

      expect(dto.createdAt).toMatch(ISO_REGEX);
      expect(dto.updatedAt).toMatch(ISO_REGEX);
    });
  });

  describe('list', () => {
    it('returns each automation with createdAt and updatedAt as valid ISO 8601 strings', async () => {
      const provider = await seedProvider(providerSettingsService);
      const query = await seedQuery(savedQueryService);

      await automationService.create({
        name: 'Automation A',
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });
      await automationService.create({
        name: 'Automation B',
        queryId: query.id,
        providerId: provider.id,
        taskId: 'deleteMovie',
        schedule: '0 0 * * *',
      });

      const dtos = await automationService.list();

      expect(dtos).toHaveLength(2);
      for (const dto of dtos) {
        expect(dto.createdAt).toMatch(ISO_REGEX);
        expect(dto.updatedAt).toMatch(ISO_REGEX);
      }
    });
  });

  describe('getById', () => {
    it('returns the automation with createdAt and updatedAt as valid ISO 8601 strings', async () => {
      const provider = await seedProvider(providerSettingsService);
      const query = await seedQuery(savedQueryService);

      const created = await automationService.create({
        name: 'Automation C',
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });

      const found = await automationService.getById(created.id);

      expect(found.createdAt).toMatch(ISO_REGEX);
      expect(found.updatedAt).toMatch(ISO_REGEX);
    });
  });

  describe('updateStatus', () => {
    it('returns the updated automation with updatedAt as a valid ISO 8601 string', async () => {
      const provider = await seedProvider(providerSettingsService);
      const query = await seedQuery(savedQueryService);

      const created = await automationService.create({
        name: 'Automation D',
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });

      const updated = await automationService.updateStatus(created.id, 'paused');

      expect(updated.createdAt).toMatch(ISO_REGEX);
      expect(updated.updatedAt).toMatch(ISO_REGEX);
    });
  });
});
