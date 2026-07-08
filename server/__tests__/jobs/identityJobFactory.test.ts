import { MetadataProviderType, mediaIdentity } from '@server/database/schema';
import { IdentityJobFactory } from '@server/jobs/identityJobFactory';
import type { AppConfig } from '@server/kernel/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/kernel/db';
import { ProviderFactory } from '@server/providers/providerFactory';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import type { IdentityJobLike } from '@server/services/systemTaskRunner';
import { eq } from 'drizzle-orm';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRadarrMovie, createSonarrSeries } from '../../../tests/factories';
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

const RADARR_URL = 'http://localhost:7878';
const SONARR_URL = 'http://localhost:8989';
const PLEX_URL = 'http://localhost:32400';

async function runIdentityJob(job: IdentityJobLike): Promise<void> {
  await job.runForMovies();
  await job.runForSeries();
  await job.runForPlex();
}

function makeFactory(): IdentityJobFactory {
  const db = getDb();
  return new IdentityJobFactory({
    db,
    providerSettingsService: new ProviderSettingsService({ db }),
    providerFactory: new ProviderFactory(),
  });
}

describe('IdentityJobFactory', () => {
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
    server.resetHandlers();
  });

  it('resolves the active Radarr provider and populates identities; absent Plex does not throw', async () => {
    const db = getDb();
    const providerSettingsService = new ProviderSettingsService({ db });
    await providerSettingsService.create({
      type: MetadataProviderType.RADARR,
      name: 'Test Radarr',
      url: `${RADARR_URL}/api/v3`,
      apiKey: 'test-api-key',
    });
    server.use(
      http.get(`${RADARR_URL}/api/v3/movie`, () =>
        HttpResponse.json([createRadarrMovie({ id: 1, tmdbId: 603 })])
      )
    );

    const job = await makeFactory().create();
    await expect(runIdentityJob(job)).resolves.toBeUndefined();

    const rows = await db
      .select()
      .from(mediaIdentity)
      .where(eq(mediaIdentity.sourceType, 'RADARR'));
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceId).toBe(1);
    expect(rows[0].tmdbId).toBe(603);
  });

  it('resolves the active Plex provider and writes plexRatingKey for matching identities', async () => {
    const db = getDb();
    const providerSettingsService = new ProviderSettingsService({ db });
    await providerSettingsService.create({
      type: MetadataProviderType.PLEX,
      name: 'Test Plex',
      url: PLEX_URL,
      apiKey: 'plex-token',
    });
    await db
      .insert(mediaIdentity)
      .values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 603, resolvedAt: 0 });
    server.use(
      http.get(`${PLEX_URL}/library/sections`, () =>
        HttpResponse.json({ MediaContainer: { Directory: [{ key: '1' }] } })
      ),
      http.get(`${PLEX_URL}/library/sections/1/all`, () =>
        HttpResponse.json({
          MediaContainer: { Metadata: [{ ratingKey: 'rk-1', guids: [{ id: 'tmdb://603' }] }] },
        })
      )
    );

    const job = await makeFactory().create();
    await runIdentityJob(job);

    const [row] = await db.select().from(mediaIdentity).where(eq(mediaIdentity.tmdbId, 603));
    expect(row.plexRatingKey).toBe('rk-1');
  });

  it('backfills tvMazeId for a Sonarr series via the tvMaze lookup', async () => {
    const db = getDb();
    const providerSettingsService = new ProviderSettingsService({ db });
    await providerSettingsService.create({
      type: MetadataProviderType.SONARR,
      name: 'Test Sonarr',
      url: `${SONARR_URL}/api/v3`,
      apiKey: 'test-api-key',
    });
    server.use(
      http.get(`${SONARR_URL}/api/v3/series`, () =>
        HttpResponse.json([createSonarrSeries({ id: 5, tvdbId: 81189 })])
      ),
      http.get('https://api.tvmaze.com/lookup/shows', () => HttpResponse.json({ id: 169 }))
    );

    const job = await makeFactory().create();
    await runIdentityJob(job);

    const [row] = await db
      .select()
      .from(mediaIdentity)
      .where(eq(mediaIdentity.sourceType, 'SONARR'));
    expect(row.tvMazeId).toBe(169);
  });
});
