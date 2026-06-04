/**
 * SavedQueryService tests — behaviour-only, real in-memory SQLite.
 *
 * Public contract:
 *   - list()   returns all saved queries ordered by createdAt
 *   - create() inserts and returns a DTO with parsed filters
 *   - delete() removes the record; throws NotFoundError for unknown id
 *
 * findById is NOT part of the public contract (no production caller).
 *
 * Run: vitest run --project server
 */
import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
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

describe('SavedQueryService', () => {
  let service: SavedQueryService;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    service = new SavedQueryService({ db: getDb() });
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  it('returns an empty array when no saved queries exist', async () => {
    const result = await service.list();
    expect(result).toEqual([]);
  });

  it('returns all saved queries ordered by createdAt', async () => {
    await service.create({ name: 'First', filters: { genre: 'action' } });
    await service.create({ name: 'Second', filters: { year: 2020 } });

    const result = await service.list();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('First');
    expect(result[1].name).toBe('Second');
  });

  it('returns createdAt as a string on each DTO', async () => {
    await service.create({ name: 'TS Test', filters: {} });

    const [row] = await service.list();

    expect(typeof row.createdAt).toBe('string');
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  it('inserts a record and returns a DTO with the correct fields', async () => {
    const filters = { genre: 'horror', year: 2021 };
    const result = await service.create({ name: 'My Query', filters });

    expect(result.id).toBeGreaterThan(0);
    expect(result.name).toBe('My Query');
    expect(result.filters).toEqual(filters);
    expect(typeof result.createdAt).toBe('string');
  });

  it('trims whitespace from the name on create', async () => {
    const result = await service.create({ name: '  Padded Name  ', filters: {} });

    expect(result.name).toBe('Padded Name');
  });

  it('stores and returns complex filter objects without data loss', async () => {
    const filters = { genre: 'sci-fi', rating: 8.5, available: true };
    const result = await service.create({ name: 'Complex', filters });

    expect(result.filters).toEqual(filters);
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  it('removes the record so it no longer appears in list', async () => {
    const created = await service.create({ name: 'To Delete', filters: {} });

    await service.delete(created.id);

    const list = await service.list();
    expect(list.find((r) => r.id === created.id)).toBeUndefined();
  });

  it('throws NotFoundError when deleting an unknown id', async () => {
    await expect(service.delete(99999)).rejects.toThrow('not found');
  });
});
