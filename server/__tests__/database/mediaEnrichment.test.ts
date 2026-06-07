import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { mediaEnrichment, mediaIdentity } from '@server/database/schema';
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

describe('media_enrichment table', () => {
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('survives a round-trip linked to a media_identity row', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 500 })
      .returning();

    const now = Math.floor(Date.now() / 1000);
    const [enr] = await db
      .insert(mediaEnrichment)
      .values({
        mediaIdentityId: identity.id,
        tautulliPlayCount: 7,
        tautulliLastPlayed: now - 3600,
        enrichedAt: now,
      })
      .returning();

    expect(enr.mediaIdentityId).toBe(identity.id);
    expect(enr.tautulliPlayCount).toBe(7);
    expect(enr.enrichedAt).toBe(now);
  });

  it('enforces UNIQUE on mediaIdentityId (one enrichment row per identity)', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 2 })
      .returning();

    const now = Math.floor(Date.now() / 1000);
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: now });
    await expect(
      db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: now })
    ).rejects.toThrow();
  });
});
