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
    const result = applyMovieFilters([baseMovie], {
      page: 1,
      pageSize: 10000,
      sort: 'title_asc',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by title substring (case-insensitive)', () => {
    const movies = [
      { ...baseMovie, id: 1, title: 'The Matrix' },
      { ...baseMovie, id: 2, title: 'Interstellar' },
    ];
    const result = applyMovieFilters(movies, {
      page: 1,
      pageSize: 10000,
      sort: 'title_asc',
      title: 'matrix',
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('The Matrix');
  });

  it('filters by hasFile', () => {
    const movies = [
      { ...baseMovie, id: 1, hasFile: true },
      { ...baseMovie, id: 2, hasFile: false, title: 'Inception' },
    ];
    const result = applyMovieFilters(movies, {
      page: 1,
      pageSize: 10000,
      sort: 'title_asc',
      hasFile: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe('applySeriesFilters', () => {
  it('returns all series when no filters are applied', () => {
    const result = applySeriesFilters([baseSeries], {
      page: 1,
      pageSize: 10000,
      sort: 'title_asc',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by seriesStatus', () => {
    const seriesList = [
      { ...baseSeries, id: 1, status: 'ended' },
      { ...baseSeries, id: 2, title: 'Ongoing', status: 'continuing' },
    ];
    const result = applySeriesFilters(seriesList, {
      page: 1,
      pageSize: 10000,
      sort: 'title_asc',
      seriesStatus: 'ended',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
