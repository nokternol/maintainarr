/**
 * SavedQueryService tests — behaviour-only, real in-memory SQLite.
 *
 * Public contract:
 *   - list()   returns all saved queries ordered by createdAt
 *   - create() inserts and returns a DTO with parsed filters
 *   - delete() removes the record; throws NotFoundError for unknown id
 *
 * Also confirms that `createdAt` in SavedQueryDto is a valid ISO 8601 string
 * produced directly from the custom datetime column's Date output,
 * without requiring a double-cast.
 *
 * findById is NOT part of the public contract (no production caller).
 *
 * Run: vitest run --project server
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
    await service.create({ name: 'First', filters: { genre: 'action' }, mediaType: 'movie' });
    await service.create({ name: 'Second', filters: { year: 2020 }, mediaType: 'movie' });

    const result = await service.list();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('First');
    expect(result[1].name).toBe('Second');
  });

  it('returns createdAt as a string on each DTO', async () => {
    await service.create({ name: 'TS Test', filters: {}, mediaType: 'movie' });

    const [row] = await service.list();

    expect(typeof row.createdAt).toBe('string');
  });

  it('returns each item with createdAt as a valid ISO 8601 string', async () => {
    await service.create({ name: 'Query A', filters: {}, mediaType: 'movie' });
    await service.create({ name: 'Query B', filters: { year: 2020 }, mediaType: 'movie' });

    const dtos = await service.list();

    expect(dtos).toHaveLength(2);
    for (const dto of dtos) {
      expect(dto.createdAt).toMatch(ISO_REGEX);
    }
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  it('inserts a record and returns a DTO with the correct fields', async () => {
    const filters = { genre: 'horror', year: 2021 };
    const result = await service.create({ name: 'My Query', filters, mediaType: 'movie' });

    expect(result.id).toBeGreaterThan(0);
    expect(result.name).toBe('My Query');
    expect(result.filters).toEqual(filters);
    expect(typeof result.createdAt).toBe('string');
  });

  it('trims whitespace from the name on create', async () => {
    const result = await service.create({
      name: '  Padded Name  ',
      filters: {},
      mediaType: 'movie',
    });

    expect(result.name).toBe('Padded Name');
  });

  it('stores and returns complex filter objects without data loss', async () => {
    const filters = { genre: 'sci-fi', rating: 8.5, available: true };
    const result = await service.create({ name: 'Complex', filters, mediaType: 'movie' });

    expect(result.filters).toEqual(filters);
  });

  it('returns createdAt as a valid ISO 8601 string', async () => {
    const dto = await service.create({
      name: 'Test Query',
      filters: { genre: 'action' },
      mediaType: 'movie',
    });

    expect(dto.createdAt).toMatch(ISO_REGEX);
  });

  it('stores the mediaType and returns it in the DTO', async () => {
    const movieDto = await service.create({ name: 'Movie Query', filters: {}, mediaType: 'movie' });
    const seriesDto = await service.create({
      name: 'Series Query',
      filters: {},
      mediaType: 'series',
    });

    expect(movieDto.mediaType).toBe('movie');
    expect(seriesDto.mediaType).toBe('series');
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  it('removes the record so it no longer appears in list', async () => {
    const created = await service.create({ name: 'To Delete', filters: {}, mediaType: 'movie' });

    await service.delete(created.id);

    const list = await service.list();
    expect(list.find((r) => r.id === created.id)).toBeUndefined();
  });

  it('throws NotFoundError when deleting an unknown id', async () => {
    await expect(service.delete(99999)).rejects.toThrow('not found');
  });
});
