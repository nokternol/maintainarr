import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { MetadataProviderType, mediaEnrichment, mediaIdentity } from '@server/database/schema';
import { EnrichmentJobFactory } from '@server/jobs/enrichmentJobFactory';
import { ProviderFactory } from '@server/providers/providerFactory';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { eq } from 'drizzle-orm';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../tests/mocks/server';

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

const TAUTULLI_URL = 'http://localhost:8181';

function makeFactory(): EnrichmentJobFactory {
  const db = getDb();
  return new EnrichmentJobFactory({
    db,
    providerSettingsService: new ProviderSettingsService({ db }),
    providerFactory: new ProviderFactory(),
  });
}

describe('EnrichmentJobFactory', () => {
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
    server.resetHandlers();
  });

  it('wires the active Tautulli provider so the job persists play counts', async () => {
    const db = getDb();
    const providerSettingsService = new ProviderSettingsService({ db });
    await providerSettingsService.create({
      type: MetadataProviderType.TAUTULLI,
      name: 'Test Tautulli',
      url: TAUTULLI_URL,
      apiKey: 'tautulli-key',
    });
    const [identity] = await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 603, plexRatingKey: '1', resolvedAt: 0 })
      .returning();
    server.use(
      http.get(`${TAUTULLI_URL}/api/v2`, () =>
        HttpResponse.json({
          response: {
            result: 'success',
            data: { data: [{ rating_key: '1', played_at: 1000 }], total_count: 1 },
          },
        })
      )
    );

    const job = await makeFactory().create();
    await job.run();

    const [row] = await db
      .select()
      .from(mediaEnrichment)
      .where(eq(mediaEnrichment.mediaIdentityId, identity.id));
    expect(row.tautulliPlayCount).toBe(1);
  });

  it('returns a runnable job when no enrichment providers are active', async () => {
    await getDb()
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 2, tmdbId: 604, resolvedAt: 0 });

    const job = await makeFactory().create();

    await expect(job.run()).resolves.toBeTypeOf('number');
  });
});
