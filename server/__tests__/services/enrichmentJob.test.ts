import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { mediaEnrichment, mediaIdentity } from '@server/database/schema';
import { EnrichmentJob } from '@server/jobs/enrichmentJob';
import type { OverseerrIssue, OverseerrRequest } from '@server/providers/overseerrProvider';
import type { PlexMediaItem } from '@server/providers/plexProvider';
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
const FRESH = NOW - 3600; // 1h ago — within 24h window
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

  it('upserts tautulliLastPlayed with the most-recent played_at from history', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'abc123' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const olderPlay = NOW - 7 * 86400; // 7 days ago
    const newerPlay = NOW - 2 * 86400; // 2 days ago

    const tautulliProvider = {
      getHistory: vi.fn().mockResolvedValue([
        {
          rating_key: 'abc123',
          title: 'Test',
          watched_status: 1,
          duration: 3600,
          play_duration: 3600,
          user: 'u1',
          played_at: olderPlay,
        },
        {
          rating_key: 'abc123',
          title: 'Test',
          watched_status: 1,
          duration: 3600,
          play_duration: 3600,
          user: 'u2',
          played_at: newerPlay,
        },
        {
          rating_key: 'other',
          title: 'Other',
          watched_status: 1,
          duration: 3600,
          play_duration: 3600,
          user: 'u1',
          played_at: NOW,
        },
      ]),
    };

    const job = new EnrichmentJob({ db, tautulliProvider });
    await job.run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.tautulliLastPlayed).toBe(newerPlay);
  });

  it('writes overseerrRequestStatus matched by tmdbId', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'abc123' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const requests: OverseerrRequest[] = [
      {
        id: 1,
        status: 2,
        type: 'movie',
        requestedBy: { id: 1, displayName: 'u', email: 'u@u.com' },
        media: { tmdbId: 100, title: 'Test' },
        createdAt: '',
      },
      {
        id: 2,
        status: 3,
        type: 'movie',
        requestedBy: { id: 1, displayName: 'u', email: 'u@u.com' },
        media: { tmdbId: 999, title: 'Other' },
        createdAt: '',
      },
    ];

    const job = new EnrichmentJob({
      db,
      overseerrProvider: {
        getRequests: vi.fn().mockResolvedValue(requests),
        getIssues: vi.fn().mockResolvedValue([]),
      },
    });
    await job.run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.overseerrRequestStatus).toBe(2);
  });

  it('writes overseerrHasIssue=true when open issues exist for a tmdbId, false when none', async () => {
    const db = getDb();
    const [id100] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'k1' })
      .returning();
    const [id200] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 2, tmdbId: 200, plexRatingKey: 'k2' })
      .returning();
    await db.insert(mediaEnrichment).values([
      { mediaIdentityId: id100.id, enrichedAt: STALE },
      { mediaIdentityId: id200.id, enrichedAt: STALE },
    ]);

    const issues: OverseerrIssue[] = [{ id: 1, status: 1, media: { tmdbId: 100 } }];

    const job = new EnrichmentJob({
      db,
      overseerrProvider: {
        getRequests: vi.fn().mockResolvedValue([]),
        getIssues: vi.fn().mockResolvedValue(issues),
      },
    });
    await job.run();

    const rows = await db.select().from(mediaEnrichment).orderBy(mediaEnrichment.mediaIdentityId);
    expect(rows[0].overseerrHasIssue).toBe(true);
    expect(rows[1].overseerrHasIssue).toBe(false);
  });

  it('writes plexViewCount and plexLastViewedAt matched by plexRatingKey', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'plex-101' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const plexItems: PlexMediaItem[] = [
      {
        ratingKey: 'plex-101',
        title: 'The Matrix',
        type: 'movie',
        viewCount: 5,
        lastViewedAt: 1700000000,
      },
      {
        ratingKey: 'plex-999',
        title: 'Other',
        type: 'movie',
        viewCount: 2,
        lastViewedAt: 1600000000,
      },
    ];

    const job = new EnrichmentJob({
      db,
      plexProvider: { getAllItems: vi.fn().mockResolvedValue(plexItems) },
    });
    await job.run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.plexViewCount).toBe(5);
    expect(enr.plexLastViewedAt).toBe(1700000000);
  });

  it('writes tmdbStatus from tmdbProvider matched by tmdbId and sourceType', async () => {
    const db = getDb();
    const [movieIdentity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100 })
      .returning();
    const [showIdentity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'SONARR', sourceId: 1, tmdbId: 200 })
      .returning();
    await db.insert(mediaEnrichment).values([
      { mediaIdentityId: movieIdentity.id, enrichedAt: STALE },
      { mediaIdentityId: showIdentity.id, enrichedAt: STALE },
    ]);

    const getStatus = vi.fn().mockImplementation((tmdbId: number, mediaType: string) => {
      if (tmdbId === 100 && mediaType === 'movie') return Promise.resolve('Released');
      if (tmdbId === 200 && mediaType === 'tv') return Promise.resolve('Ended');
      return Promise.resolve(null);
    });

    const job = new EnrichmentJob({ db, tmdbProvider: { getStatus } });
    await job.run();

    const rows = await db.select().from(mediaEnrichment).orderBy(mediaEnrichment.mediaIdentityId);
    expect(rows[0].tmdbStatus).toBe('Released');
    expect(rows[1].tmdbStatus).toBe('Ended');
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
        {
          rating_key: 'abc123',
          title: 'Test',
          watched_status: 1,
          duration: 3600,
          play_duration: 3600,
          user: 'u1',
        },
        {
          rating_key: 'abc123',
          title: 'Test',
          watched_status: 1,
          duration: 3600,
          play_duration: 3600,
          user: 'u2',
        },
        {
          rating_key: 'other',
          title: 'Other',
          watched_status: 1,
          duration: 3600,
          play_duration: 3600,
          user: 'u1',
        },
      ]),
    };

    const job = new EnrichmentJob({ db, tautulliProvider });
    await job.run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.tautulliPlayCount).toBe(2);
    expect(enr.enrichedAt).toBeGreaterThan(STALE);
  });
});
