import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { mediaIdentity } from '@server/database/schema';
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

describe('media_identity table', () => {
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('survives a round-trip for a RADARR row', async () => {
    const db = getDb();
    const [row] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 42, tmdbId: 100, imdbId: 'tt1234567' })
      .returning();

    expect(row.sourceType).toBe('RADARR');
    expect(row.sourceId).toBe(42);
    expect(row.tmdbId).toBe(100);
    expect(row.imdbId).toBe('tt1234567');
    expect(row.id).toBeTypeOf('number');
  });

  it('enforces UNIQUE(sourceType, sourceId)', async () => {
    const db = getDb();
    await db.insert(mediaIdentity).values({ sourceType: 'RADARR', sourceId: 1 });
    await expect(
      db.insert(mediaIdentity).values({ sourceType: 'RADARR', sourceId: 1 })
    ).rejects.toThrow();
  });
});
