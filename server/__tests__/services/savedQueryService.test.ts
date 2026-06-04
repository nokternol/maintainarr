/**
 * SavedQueryService tests — date field type safety.
 *
 * Confirms that `createdAt` in SavedQueryDto is a valid ISO 8601 string
 * produced directly from the custom datetime column's Date output,
 * without requiring a double-cast.
 *
 * Uses a real in-memory SQLite database so the column's fromDriver
 * converter runs end-to-end.
 *
 * Run: yarn vitest run --project server
 */
import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
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

describe('SavedQueryService', () => {
  let service: SavedQueryService;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    service = new SavedQueryService({ db: getDb() });
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  describe('create', () => {
    it('returns createdAt as a valid ISO 8601 string', async () => {
      const dto = await service.create({ name: 'Test Query', filters: { genre: 'action' } });

      expect(dto.createdAt).toMatch(ISO_REGEX);
    });
  });

  describe('list', () => {
    it('returns each item with createdAt as a valid ISO 8601 string', async () => {
      await service.create({ name: 'Query A', filters: {} });
      await service.create({ name: 'Query B', filters: { year: 2020 } });

      const dtos = await service.list();

      expect(dtos).toHaveLength(2);
      for (const dto of dtos) {
        expect(dto.createdAt).toMatch(ISO_REGEX);
      }
    });
  });

  describe('findById', () => {
    it('returns the saved query with createdAt as a valid ISO 8601 string', async () => {
      const created = await service.create({ name: 'Query C', filters: {} });

      const found = await service.findById(created.id);

      expect(found.createdAt).toMatch(ISO_REGEX);
    });
  });
});
