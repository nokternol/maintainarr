/**
 * AutomationService tests — mutation methods return fully-joined data.
 *
 * Uses a real in-memory SQLite DB so queries run against actual SQL.
 * No HTTP mocks needed — this service does not make outbound calls.
 *
 * Run: vitest run --project server
 */
import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { AutomationService } from '@server/services/automationService';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { SavedQueryService } from '@server/services/savedQueryService';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  describe('create()', () => {
    it('returns a dto with query.name and provider.type populated from the joined rows', async () => {
      const query = await savedQueryService.create({ name: 'My Query', filters: { hasFile: true } });
      const provider = await providerSettingsService.create({
        type: MetadataProviderType.RADARR,
        name: 'Test Radarr',
        url: 'http://localhost:7878/api/v3',
        apiKey: 'key',
      });

      const dto = await automationService.create({
        name: 'My Automation',
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });

      expect(dto.query.name).toBe('My Query');
      expect(dto.query.filters).toEqual({ hasFile: true });
      expect(dto.provider.name).toBe('Test Radarr');
      expect(dto.provider.type).toBe(MetadataProviderType.RADARR);
    });
  });

  describe('updateStatus()', () => {
    it('returns a dto with query.name and provider.type populated from the joined rows', async () => {
      const query = await savedQueryService.create({ name: 'Status Query', filters: {} });
      const provider = await providerSettingsService.create({
        type: MetadataProviderType.SONARR,
        name: 'Test Sonarr',
        url: 'http://localhost:8989/api/v3',
        apiKey: 'key',
      });

      const created = await automationService.create({
        name: 'Status Automation',
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
        schedule: '0 * * * *',
      });

      const dto = await automationService.updateStatus(created.id, 'paused');

      expect(dto.status).toBe('paused');
      expect(dto.query.name).toBe('Status Query');
      expect(dto.provider.name).toBe('Test Sonarr');
      expect(dto.provider.type).toBe(MetadataProviderType.SONARR);
    });
  });
});
