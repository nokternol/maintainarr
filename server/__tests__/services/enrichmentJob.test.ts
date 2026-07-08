import { MetadataProviderType, mediaEnrichment, mediaIdentity } from '@server/database/schema';
import { EnrichmentJob } from '@server/jobs/enrichmentJob';
import type { AppConfig } from '@server/kernel/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/kernel/db';
import type { MediaEnricher, MediaItem } from '@server/providers/roles';
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

/** A MediaEnricher that decorates whatever items it is handed with fixed fields. */
function fakeEnricher(
  provider: MetadataProviderType,
  decorate: (item: MediaItem) => Partial<MediaItem> | undefined
): MediaEnricher {
  return {
    enrich: vi.fn(async (items: MediaItem[]) => ({
      provider,
      items: items
        .map((item) => {
          const fields = decorate(item);
          return fields ? ({ ...item, ...fields } as MediaItem) : undefined;
        })
        .filter((i): i is MediaItem => i !== undefined),
    })),
  };
}

describe('EnrichmentJob', () => {
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('skips identity rows enriched within 24h — no enricher is queried', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'fresh' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: FRESH });

    const enricher = fakeEnricher(MetadataProviderType.PLEX, () => undefined);
    await new EnrichmentJob({ db, enrichers: [enricher] }).run();

    expect(enricher.enrich).not.toHaveBeenCalled();
  });

  it('persists the resolved canonical play count for a stale identity', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'abc123' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const tautulli = fakeEnricher(MetadataProviderType.TAUTULLI, (item) =>
      item._sourceIds.plex === 'abc123' ? { playCount: 2 } : undefined
    );
    await new EnrichmentJob({ db, enrichers: [tautulli] }).run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.playCount).toBe(2);
    expect(enr.enrichedAt).toBeGreaterThan(STALE);
  });

  it('resolves a field per precedence across enrichers (Tautulli over Plex for playCount)', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100, plexRatingKey: 'k' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const plex = fakeEnricher(MetadataProviderType.PLEX, () => ({ playCount: 2 }));
    const tautulli = fakeEnricher(MetadataProviderType.TAUTULLI, () => ({ playCount: 5 }));
    await new EnrichmentJob({ db, enrichers: [plex, tautulli] }).run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.playCount).toBe(5);
  });

  it('persists an ISO last-watched value resolved from an enricher', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, plexRatingKey: 'k' })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const iso = new Date(1_700_000_000 * 1000).toISOString();
    const tautulli = fakeEnricher(MetadataProviderType.TAUTULLI, () => ({ lastWatchedAt: iso }));
    await new EnrichmentJob({ db, enrichers: [tautulli] }).run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.lastWatchedAt).toBe(iso);
  });

  it('leaves canonical columns null for an identity no enricher touched', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100 })
      .returning();
    await db.insert(mediaEnrichment).values({ mediaIdentityId: identity.id, enrichedAt: STALE });

    const tautulli = fakeEnricher(MetadataProviderType.TAUTULLI, () => undefined);
    await new EnrichmentJob({ db, enrichers: [tautulli] }).run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.playCount).toBeNull();
    expect(enr.enrichedAt).toBeGreaterThan(STALE);
  });

  it('inserts an enrichment row when the stale identity has none yet', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, plexRatingKey: 'k' })
      .returning();

    const tautulli = fakeEnricher(MetadataProviderType.TAUTULLI, () => ({ playCount: 7 }));
    await new EnrichmentJob({ db, enrichers: [tautulli] }).run();

    const [enr] = await db.select().from(mediaEnrichment);
    expect(enr.mediaIdentityId).toBe(identity.id);
    expect(enr.playCount).toBe(7);
  });

  it('returns the number of identity rows it enriched', async () => {
    const db = getDb();
    const [id100] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100 })
      .returning();
    const [id200] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 2, tmdbId: 200 })
      .returning();
    await db.insert(mediaEnrichment).values([
      { mediaIdentityId: id100.id, enrichedAt: STALE },
      { mediaIdentityId: id200.id, enrichedAt: STALE },
    ]);

    const job = new EnrichmentJob({
      db,
      enrichers: [fakeEnricher(MetadataProviderType.TAUTULLI, () => undefined)],
    });

    expect(await job.run()).toBe(2);
  });
});
