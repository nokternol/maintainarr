import {
  MetadataProviderType,
  mediaIdentity,
  mediaItems,
  metadataProviders,
} from '@server/database/schema';
import type { AppConfig } from '@server/kernel/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/kernel/db';
import type { RadarrMovie } from '@server/modules/providers/connections/radarrProvider';
import type { SonarrSeries } from '@server/modules/providers/connections/sonarrProvider';
import { IdentityResolutionJob } from '@server/modules/providers/identityResolutionJob';
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

const makeMovie = (overrides: Partial<RadarrMovie> = {}): RadarrMovie => ({
  id: 1,
  title: 'Test Movie',
  hasFile: true,
  monitored: true,
  tmdbId: 100,
  imdbId: 'tt0000001',
  profileId: 1,
  qualityProfileId: 1,
  tags: [],
  folderName: '/movies/test',
  path: '/movies/test',
  ...overrides,
});

const makeSeries = (overrides: Partial<SonarrSeries> = {}): SonarrSeries => ({
  id: 10,
  title: 'Test Series',
  status: 'continuing',
  monitored: true,
  tvdbId: 200,
  tmdbId: 300,
  imdbId: 'tt0000002',
  tvMazeId: 400,
  profileId: 1,
  qualityProfileId: 1,
  languageProfileId: 1,
  tags: [],
  path: '/tv/test',
  seasons: [],
  ...overrides,
});

describe('IdentityResolutionJob', () => {
  let radarrProviderId: number;
  let sonarrProviderId: number;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    const db = getDb();
    [{ id: radarrProviderId }] = await db
      .insert(metadataProviders)
      .values({ type: MetadataProviderType.RADARR, name: 'Radarr', url: 'http://radarr' })
      .returning({ id: metadataProviders.id });
    [{ id: sonarrProviderId }] = await db
      .insert(metadataProviders)
      .values({ type: MetadataProviderType.SONARR, name: 'Sonarr', url: 'http://sonarr' })
      .returning({ id: metadataProviders.id });
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('sets plexRatingKey on media_identity rows where a Plex guid matches by tmdbId', async () => {
    const db = getDb();
    await db.insert(mediaIdentity).values({ kind: 'movie', tmdbId: 100 });

    const plexProvider = {
      getAllItems: vi
        .fn()
        .mockResolvedValue([{ ratingKey: 'plex-key-42', guids: [{ id: 'tmdb://100' }] }]),
    };

    const job = new IdentityResolutionJob({ db, plexProvider });
    await job.runForPlex();

    const rows = await db.select().from(mediaIdentity);
    expect(rows[0].plexRatingKey).toBe('plex-key-42');
  });

  it('runForPlex counts rows actually changed, not Plex items processed', async () => {
    const db = getDb();
    await db.insert(mediaIdentity).values({ kind: 'movie', tmdbId: 100 });

    const plexProvider = {
      getAllItems: vi.fn().mockResolvedValue([
        { ratingKey: 'plex-match', guids: [{ id: 'tmdb://100' }] }, // updates 1 row
        { ratingKey: 'plex-miss', guids: [{ id: 'tmdb://999' }] }, // matches no row
      ]),
    };

    const job = new IdentityResolutionJob({ db, plexProvider });

    expect(await job.runForPlex()).toBe(1);
  });

  it('upserts a Radarr movie into media_identity (kind=movie) and a media_item copy for the instance', async () => {
    const db = getDb();
    const radarrProvider = { getMovies: vi.fn().mockResolvedValue([makeMovie()]) };

    const job = new IdentityResolutionJob({ db, radarrProvider, radarrProviderId });
    await job.runForMovies();

    const identities = await db.select().from(mediaIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0].kind).toBe('movie');
    expect(identities[0].tmdbId).toBe(100);
    expect(identities[0].imdbId).toBe('tt0000001');

    const items = await db.select().from(mediaItems);
    expect(items).toHaveLength(1);
    expect(items[0].providerId).toBe(radarrProviderId);
    expect(items[0].externalId).toBe(1);
    expect(items[0].mediaIdentityId).toBe(identities[0].id);
  });

  it('upserts a Sonarr series into media_identity (kind=show) and a media_item copy for the instance', async () => {
    const db = getDb();
    const sonarrProvider = { getSeries: vi.fn().mockResolvedValue([makeSeries()]) };

    const job = new IdentityResolutionJob({ db, sonarrProvider, sonarrProviderId });
    await job.runForSeries();

    const identities = await db.select().from(mediaIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0].kind).toBe('show');
    expect(identities[0].tvdbId).toBe(200);
    expect(identities[0].tmdbId).toBe(300);
    expect(identities[0].imdbId).toBe('tt0000002');
    expect(identities[0].tvMazeId).toBe(400);

    const items = await db.select().from(mediaItems);
    expect(items).toHaveLength(1);
    expect(items[0].providerId).toBe(sonarrProviderId);
    expect(items[0].externalId).toBe(10);
  });

  it('waits 500ms between consecutive TVMaze lookups', async () => {
    const db = getDb();
    const sonarrProvider = {
      getSeries: vi.fn().mockResolvedValue([
        makeSeries({ id: 10, tvdbId: 200, tvMazeId: undefined }),
        makeSeries({ id: 11, tvdbId: 201, tvMazeId: undefined }),
        makeSeries({ id: 12, tvdbId: 202, tvMazeId: 500 }), // already has tvMazeId — no delay
      ]),
    };
    const tvMazeLookup = { lookupByTvdbId: vi.fn().mockResolvedValue({ id: 999 }) };
    const delay = vi.fn().mockResolvedValue(undefined);

    const job = new IdentityResolutionJob({
      db,
      sonarrProvider,
      sonarrProviderId,
      tvMazeLookup,
      delay,
    });
    await job.runForSeries();

    // delay called once: between first and second lookup (not before first, not for the series with tvMazeId)
    expect(delay).toHaveBeenCalledTimes(1);
    expect(delay).toHaveBeenCalledWith(500);
  });

  it('fetches tvMazeId via TVMaze lookup when series has no tvMazeId', async () => {
    const db = getDb();
    const sonarrProvider = {
      getSeries: vi.fn().mockResolvedValue([makeSeries({ tvMazeId: undefined })]),
    };
    const tvMazeLookup = {
      lookupByTvdbId: vi.fn().mockResolvedValue({ id: 999 }),
    };

    const job = new IdentityResolutionJob({ db, sonarrProvider, sonarrProviderId, tvMazeLookup });
    await job.runForSeries();

    const rows = await db.select().from(mediaIdentity);
    expect(rows).toHaveLength(1);
    expect(rows[0].tvMazeId).toBe(999);
  });

  it('runForMovies returns the number of movies it upserted', async () => {
    const db = getDb();
    const radarrProvider = {
      getMovies: vi
        .fn()
        .mockResolvedValue([makeMovie({ id: 1, tmdbId: 100 }), makeMovie({ id: 2, tmdbId: 200 })]),
    };

    const job = new IdentityResolutionJob({ db, radarrProvider, radarrProviderId });

    expect(await job.runForMovies()).toBe(2);
  });

  it('runForMovies returns 0 when no Radarr provider is configured', async () => {
    const db = getDb();
    const job = new IdentityResolutionJob({ db });

    expect(await job.runForMovies()).toBe(0);
  });

  it('runForSeries returns the number of series it upserted', async () => {
    const db = getDb();
    const sonarrProvider = {
      getSeries: vi
        .fn()
        .mockResolvedValue([
          makeSeries({ id: 10, tvdbId: 200 }),
          makeSeries({ id: 11, tvdbId: 201 }),
        ]),
    };

    const job = new IdentityResolutionJob({ db, sonarrProvider, sonarrProviderId });

    expect(await job.runForSeries()).toBe(2);
  });

  it('runForSeries returns 0 when no Sonarr provider is configured', async () => {
    const db = getDb();
    const job = new IdentityResolutionJob({ db });

    expect(await job.runForSeries()).toBe(0);
  });

  it('is idempotent — re-running with same movies does not duplicate rows', async () => {
    const db = getDb();
    const radarrProvider = { getMovies: vi.fn().mockResolvedValue([makeMovie()]) };

    const job = new IdentityResolutionJob({ db, radarrProvider, radarrProviderId });
    await job.runForMovies();
    await job.runForMovies();

    const identities = await db.select().from(mediaIdentity);
    expect(identities).toHaveLength(1);
    const items = await db.select().from(mediaItems);
    expect(items).toHaveLength(1);
  });
});
