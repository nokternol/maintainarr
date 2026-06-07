import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { mediaEnrichment, mediaIdentity } from '@server/database/schema';
import { EnrichmentJob } from '@server/jobs/enrichmentJob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const NOW = Math.floor(Date.now() / 1000);
const FRESH = NOW - 3600;      // 1h ago — within 24h window
const STALE = NOW - 86400 - 1; // just past 24h — needs re-enrichment

describe('EnrichmentJob', () => {
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('skips identity rows where enrichedAt is within 24h', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'fresh-key' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: FRESH });

    const tautulliProvider = { getHistory: vi.fn().mockResolvedValue([]) };
    const job = new EnrichmentJob({ db, tautulliProvider });
    await job.run();

    expect(tautulliProvider.getHistory).not.toHaveBeenCalled();
  });

  it('upserts tautulliPlayCount from history for a stale identity row', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'abc123' })
      .returning();
    // stale enrichment row — older than 24h
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const tautulliProvider = {
      getHistory: vi.fn().mockResolvedValue([
        { rating_key: 'abc123', title: 'Test', watched_status: 1, duration: 3600, play_duration: 3600, user: 'u1' },
        { rating_key: 'abc123', title: 'Test', watched_status: 1, duration: 3600, play_duration: 3600, user: 'u2' },
        { rating_key: 'other',  title: 'Other', watched_status: 1, duration: 3600, play_duration: 3600, user: 'u1' },
      ]),
    };

    const job = new EnrichmentJob({ db, tautulliProvider });
    await job.run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.tautulliPlayCount).toBe(2);
    expect(enr.enrichedAt).toBeGreaterThan(STALE);
  });
});
