import { mediaEnrichment, mediaIdentity } from '@server/database/schema';
import type { AppConfig } from '@server/kernel/config';
/**
 * Phase 2 — Cycle 2.1. Shared identity→enrichment merge extracted from
 * AutomationExecutor.mergeEnrichment. One implementation, used by both the
 * executor and the media browse handler.
 *
 * Run: vitest run --project server
 */
import { _resetDatabase, getDb, initializeDatabase } from '@server/kernel/db';
import { mergeEnrichment } from '@server/modules/media/enrichmentMerge';
import type { NormalizedMovie } from '@server/modules/media/movie';
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

function movie(id: number, title: string): NormalizedMovie {
  return { _sourceIds: { radarr: id }, title };
}

describe('mergeEnrichment', () => {
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });
  afterEach(async () => {
    await _resetDatabase();
  });

  it('maps enrichment onto the matching item by sourceType + sourceId', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1 })
      .returning();
    await db.insert(mediaEnrichment).values({
      mediaIdentityId: identity.id,
      playCount: 3,
      overseerrRequestStatus: 2,
      overseerrHasIssue: true,
      tmdbStatus: 'Released',
      enrichedAt: Math.floor(Date.now() / 1000),
    });

    const items = [movie(1, 'Enriched'), movie(2, 'Bare')];
    await mergeEnrichment(db, items, 'RADARR', (m) => m._sourceIds.radarr);

    expect(items[0]).toMatchObject({
      playCount: 3,
      overseerrRequestStatus: 2,
      overseerrHasIssue: true,
      tmdbStatus: 'Released',
    });
    // No identity/enrichment for sourceId 2 → left untouched.
    expect(items[1].playCount).toBeUndefined();
    expect(items[1].overseerrRequestStatus).toBeUndefined();
  });

  it('leaves fields undefined when the enrichment row holds null for them', async () => {
    const db = getDb();
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 5 })
      .returning();
    await db.insert(mediaEnrichment).values({
      mediaIdentityId: identity.id,
      playCount: null,
      overseerrRequestStatus: null,
      tmdbStatus: null,
      enrichedAt: Math.floor(Date.now() / 1000),
    });

    const items = [movie(5, 'NullEnrichment')];
    await mergeEnrichment(db, items, 'RADARR', (m) => m._sourceIds.radarr);

    expect(items[0].playCount).toBeUndefined();
    expect(items[0].overseerrRequestStatus).toBeUndefined();
    expect(items[0].tmdbStatus).toBeUndefined();
  });

  it('no-ops when no items carry a source id', async () => {
    const db = getDb();
    const items: NormalizedMovie[] = [{ _sourceIds: {}, title: 'No source id' }];
    await expect(
      mergeEnrichment(db, items, 'RADARR', (m) => m._sourceIds.radarr)
    ).resolves.toBeUndefined();
    expect(items[0].playCount).toBeUndefined();
  });
});
