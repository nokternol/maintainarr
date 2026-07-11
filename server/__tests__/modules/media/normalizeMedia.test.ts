import { normalizeRadarrMovie, normalizeSonarrSeries } from '@server/modules/media/normalizeMedia';
import type { RadarrMovie, SonarrSeries } from '@server/modules/providers';
import { describe, expect, it } from 'vitest';

const baseMovie: RadarrMovie = {
  id: 1,
  title: 'Inception',
  year: 2010,
  hasFile: true,
  monitored: true,
  tmdbId: 27205,
  imdbId: 'tt1375666',
  profileId: 1,
  qualityProfileId: 1,
  tags: [],
  folderName: '/movies/inception',
  path: '/movies/inception',
};

const baseSeries: SonarrSeries = {
  id: 10,
  title: 'Breaking Bad',
  year: 2008,
  status: 'ended',
  monitored: true,
  tvdbId: 81189,
  tmdbId: 1396,
  imdbId: 'tt0903747',
  profileId: 1,
  qualityProfileId: 1,
  languageProfileId: 1,
  tags: [],
  path: '/tv/breaking-bad',
  seasons: [],
};

describe('normalizeRadarrMovie', () => {
  it('carries the constructing instance id in _sourceIds.providerId', () => {
    const item = normalizeRadarrMovie(baseMovie, 7);
    expect(item._sourceIds.providerId).toBe(7);
    expect(item._sourceIds.radarr).toBe(1);
  });

  it('populates the logical tmdb/imdb ids the resolver and enrichment join key on', () => {
    const item = normalizeRadarrMovie(baseMovie, 7);
    expect(item._sourceIds.tmdb).toBe(27205);
    expect(item._sourceIds.imdb).toBe('tt1375666');
  });
});

describe('normalizeSonarrSeries', () => {
  it('carries the constructing instance id in _sourceIds.providerId', () => {
    const item = normalizeSonarrSeries(baseSeries, 9);
    expect(item._sourceIds.providerId).toBe(9);
    expect(item._sourceIds.sonarr).toBe(10);
  });

  it('populates the logical tvdb/tmdb ids the resolver and enrichment join key on', () => {
    const item = normalizeSonarrSeries(baseSeries, 9);
    expect(item._sourceIds.tvdb).toBe(81189);
    expect(item._sourceIds.tmdb).toBe(1396);
  });
});
