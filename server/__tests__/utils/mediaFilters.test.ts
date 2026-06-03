/**
 * mediaFilters — pure filter functions extracted from the media handler layer.
 * Services may safely import from this module without incurring a handler dependency.
 *
 * Run: vitest run --project server
 */
import { applyMovieFilters, applySeriesFilters } from '@server/utils/mediaFilters';
import { describe, expect, it } from 'vitest';

const baseMovie = {
  id: 1,
  title: 'The Matrix',
  year: 1999,
  hasFile: true,
  monitored: true,
  tmdbId: 603,
  profileId: 1,
  qualityProfileId: 1,
  tags: [],
  folderName: '/movies/The Matrix',
  path: '/movies/The Matrix',
};

const baseSeries = {
  id: 1,
  title: 'Breaking Bad',
  year: 2008,
  status: 'ended',
  monitored: true,
  tvdbId: 81189,
  profileId: 1,
  qualityProfileId: 1,
  languageProfileId: 1,
  tags: [],
  path: '/tv/Breaking Bad',
  seasons: [],
};

describe('applyMovieFilters', () => {
  it('returns all movies when no filters are applied', () => {
    const result = applyMovieFilters([baseMovie], {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by title substring (case-insensitive)', () => {
    const movies = [
      { ...baseMovie, id: 1, title: 'The Matrix' },
      { ...baseMovie, id: 2, title: 'Interstellar' },
    ];
    const result = applyMovieFilters(movies, { title: 'matrix' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('The Matrix');
  });

  it('filters by hasFile', () => {
    const movies = [
      { ...baseMovie, id: 1, hasFile: true },
      { ...baseMovie, id: 2, hasFile: false, title: 'Inception' },
    ];
    const result = applyMovieFilters(movies, { hasFile: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by yearMin and yearMax', () => {
    const movies = [
      { ...baseMovie, id: 1, year: 1999 },
      { ...baseMovie, id: 2, title: 'Inception', year: 2010 },
      { ...baseMovie, id: 3, title: 'Interstellar', year: 2014 },
    ];
    expect(applyMovieFilters(movies, { yearMin: 2005 })).toHaveLength(2);
    expect(applyMovieFilters(movies, { yearMax: 2000 })).toHaveLength(1);
    expect(applyMovieFilters(movies, { yearMin: 2005, yearMax: 2011 })).toHaveLength(1);
  });

  it('filters by movieTagIds (all required)', () => {
    const movies = [
      { ...baseMovie, id: 1, tags: [1, 2] },
      { ...baseMovie, id: 2, title: 'Inception', tags: [1] },
    ];
    const result = applyMovieFilters(movies, { movieTagIds: '1,2' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by movieGenres (any match)', () => {
    const movies = [
      { ...baseMovie, id: 1, genres: ['Action', 'Sci-Fi'] },
      { ...baseMovie, id: 2, title: 'Inception', genres: ['Thriller'] },
    ];
    const result = applyMovieFilters(movies, { movieGenres: 'Sci-Fi' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe('applySeriesFilters', () => {
  it('returns all series when no filters are applied', () => {
    const result = applySeriesFilters([baseSeries], {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by seriesStatus', () => {
    const seriesList = [
      { ...baseSeries, id: 1, status: 'ended' },
      { ...baseSeries, id: 2, title: 'Ongoing', status: 'continuing' },
    ];
    const result = applySeriesFilters(seriesList, { seriesStatus: 'ended' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by monitored', () => {
    const seriesList = [
      { ...baseSeries, id: 1, monitored: true },
      { ...baseSeries, id: 2, title: 'Archived', monitored: false },
    ];
    expect(applySeriesFilters(seriesList, { monitored: true })).toHaveLength(1);
    expect(applySeriesFilters(seriesList, { monitored: false })[0].id).toBe(2);
  });

  it('filters by seriesType', () => {
    const seriesList = [
      { ...baseSeries, id: 1, seriesType: 'standard' },
      { ...baseSeries, id: 2, title: 'Anime Show', seriesType: 'anime' },
    ];
    const result = applySeriesFilters(seriesList, { seriesType: 'anime' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by network', () => {
    const seriesList = [
      { ...baseSeries, id: 1, network: 'HBO' },
      { ...baseSeries, id: 2, title: 'Netflix Show', network: 'Netflix' },
    ];
    const result = applySeriesFilters(seriesList, { network: 'HBO' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
