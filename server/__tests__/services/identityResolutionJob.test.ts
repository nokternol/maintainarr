import { mediaIdentity } from '@server/database/schema';
import { IdentityResolutionJob } from '@server/jobs/identityResolutionJob';
import type { AppConfig } from '@server/kernel/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/kernel/db';
import type { RadarrMovie } from '@server/providers/radarrProvider';
import type { SonarrSeries } from '@server/providers/sonarrProvider';
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
  beforeEach(async () => {
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('sets plexRatingKey on media_identity rows where a Plex guid matches by tmdbId', async () => {
    const db = getDb();
    // seed a RADARR identity row with tmdbId=100
    await db.insert(mediaIdentity).values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100 });

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
    // one identity exists for tmdbId=100; nothing for tmdbId=999
    await db.insert(mediaIdentity).values({ sourceType: 'RADARR', sourceId: 1, tmdbId: 100 });

    const plexProvider = {
      getAllItems: vi.fn().mockResolvedValue([
        { ratingKey: 'plex-match', guids: [{ id: 'tmdb://100' }] }, // updates 1 row
        { ratingKey: 'plex-miss', guids: [{ id: 'tmdb://999' }] }, // matches no row
      ]),
    };

    const job = new IdentityResolutionJob({ db, plexProvider });

    expect(await job.runForPlex()).toBe(1);
  });

  it('upserts Radarr movies into media_identity with sourceType=RADARR', async () => {
    const db = getDb();
    const radarrProvider = { getMovies: vi.fn().mockResolvedValue([makeMovie()]) };

    const job = new IdentityResolutionJob({ db, radarrProvider });
    await job.runForMovies();

    const rows = await db.select().from(mediaIdentity);
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceType).toBe('RADARR');
    expect(rows[0].sourceId).toBe(1);
    expect(rows[0].tmdbId).toBe(100);
    expect(rows[0].imdbId).toBe('tt0000001');
  });

  it('upserts Sonarr series into media_identity with sourceType=SONARR', async () => {
    const db = getDb();
    const sonarrProvider = { getSeries: vi.fn().mockResolvedValue([makeSeries()]) };

    const job = new IdentityResolutionJob({ db, sonarrProvider });
    await job.runForSeries();

    const rows = await db.select().from(mediaIdentity);
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceType).toBe('SONARR');
    expect(rows[0].sourceId).toBe(10);
    expect(rows[0].tvdbId).toBe(200);
    expect(rows[0].tmdbId).toBe(300);
    expect(rows[0].imdbId).toBe('tt0000002');
    expect(rows[0].tvMazeId).toBe(400);
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

    const job = new IdentityResolutionJob({ db, sonarrProvider, tvMazeLookup, delay });
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

    const job = new IdentityResolutionJob({ db, sonarrProvider, tvMazeLookup });
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

    const job = new IdentityResolutionJob({ db, radarrProvider });

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

    const job = new IdentityResolutionJob({ db, sonarrProvider });

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

    const job = new IdentityResolutionJob({ db, radarrProvider });
    await job.runForMovies();
    await job.runForMovies();

    const rows = await db.select().from(mediaIdentity);
    expect(rows).toHaveLength(1);
  });
});
