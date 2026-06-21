import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { SavedQueryService } from '@server/services/savedMediaQueryService';
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

  // ── list ──────────────────────────────────────────────────────────────────

  it('returns an empty array when no saved queries exist', async () => {
    expect(await service.list()).toEqual([]);
  });

  it('returns all saved queries ordered by createdAt', async () => {
    await service.create({ name: 'First', contentType: 'movie', filterValues: [] });
    await service.create({ name: 'Second', contentType: 'show', filterValues: [] });

    const result = await service.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('First');
    expect(result[1].name).toBe('Second');
  });

  it('returns each item with createdAt as a valid ISO 8601 string', async () => {
    await service.create({ name: 'Q', contentType: 'movie', filterValues: [] });
    const [dto] = await service.list();
    expect(dto.createdAt).toMatch(ISO_REGEX);
  });

  it('returns filterValues array with registry-coerced types', async () => {
    await service.create({
      name: 'Movie Q',
      contentType: 'movie',
      filterValues: [
        { key: 'hasFile', value: true },
        { key: 'yearMin', value: 2010 },
        { key: 'title', value: 'Inception' },
      ],
    });

    const [dto] = await service.list();
    expect(dto.filterValues).toHaveLength(3);
    const hasFile = dto.filterValues.find((f) => f.key === 'hasFile');
    expect(hasFile?.value).toBe(true);
    const yearMin = dto.filterValues.find((f) => f.key === 'yearMin');
    expect(yearMin?.value).toBe(2010);
    const title = dto.filterValues.find((f) => f.key === 'title');
    expect(title?.value).toBe('Inception');
  });

  it('returns contentType on each dto', async () => {
    await service.create({ name: 'Movies', contentType: 'movie', filterValues: [] });
    await service.create({ name: 'Shows', contentType: 'show', filterValues: [] });

    const result = await service.list();
    expect(result[0].contentType).toBe('movie');
    expect(result[1].contentType).toBe('show');
  });

  it('returns health: healthy when query has no filter values', async () => {
    await service.create({ name: 'Empty', contentType: 'movie', filterValues: [] });
    const [dto] = await service.list();
    expect(dto.health.status).toBe('healthy');
    expect(dto.health.providerStatus).toEqual([]);
  });

  it('returns health: degraded when filter source providers are not configured', async () => {
    await service.create({
      name: 'Filtered',
      contentType: 'movie',
      filterValues: [{ key: 'hasFile', value: true }],
    });
    const [dto] = await service.list();
    // No providers configured in test DB → all optional filters degrade
    expect(dto.health.status).toBe('degraded');
  });

  // ── create ────────────────────────────────────────────────────────────────

  it('inserts and returns a DTO with correct fields', async () => {
    const dto = await service.create({
      name: 'My Query',
      contentType: 'movie',
      filterValues: [{ key: 'yearMin', value: 2015 }],
    });

    expect(dto.id).toBeGreaterThan(0);
    expect(dto.name).toBe('My Query');
    expect(dto.contentType).toBe('movie');
    expect(dto.filterValues).toHaveLength(1);
    expect(dto.filterValues[0]).toEqual({ key: 'yearMin', value: 2015 });
    expect(dto.createdAt).toMatch(ISO_REGEX);
  });

  it('trims whitespace from name on create', async () => {
    const dto = await service.create({
      name: '  Padded  ',
      contentType: 'movie',
      filterValues: [],
    });
    expect(dto.name).toBe('Padded');
  });

  it('throws ValidationError for unknown filter key', async () => {
    await expect(
      service.create({
        name: 'Bad',
        contentType: 'movie',
        filterValues: [{ key: 'nonExistentKey', value: 'x' }],
      })
    ).rejects.toThrow('nonExistentKey');
  });

  it('throws ValidationError when filter key does not match contentType', async () => {
    await expect(
      service.create({
        name: 'Wrong type',
        contentType: 'movie',
        filterValues: [{ key: 'seriesStatus', value: 'ended' }],
      })
    ).rejects.toThrow('seriesStatus');
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it('removes the record so it no longer appears in list', async () => {
    const created = await service.create({
      name: 'To Delete',
      contentType: 'movie',
      filterValues: [],
    });
    await service.delete(created.id);
    const list = await service.list();
    expect(list.find((r) => r.id === created.id)).toBeUndefined();
  });

  it('cascades delete to filter values', async () => {
    const created = await service.create({
      name: 'With Filters',
      contentType: 'movie',
      filterValues: [{ key: 'hasFile', value: true }],
    });
    await service.delete(created.id);
    // Verify via list — if cascade works, no orphan rows cause issues
    expect(await service.list()).toHaveLength(0);
  });

  it('throws NotFoundError when deleting an unknown id', async () => {
    await expect(service.delete(99999)).rejects.toThrow('not found');
  });
});
