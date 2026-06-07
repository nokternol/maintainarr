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

  it('filters by movieTagIds (any match — OR semantics)', () => {
    const movies = [
      { ...baseMovie, id: 1, tags: [1, 2] },
      { ...baseMovie, id: 2, title: 'Inception', tags: [1] },
      { ...baseMovie, id: 3, title: 'Interstellar', tags: [3] },
    ];
    // Both movies with tag 1 OR tag 2 should be included; movie with only tag 3 is excluded
    const result = applyMovieFilters(movies, { movieTagIds: '1,2' });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining([1, 2]));
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

describe('addedDaysAgo filter', () => {
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

  it('matches a movie added more than 90 days ago when addedDaysAgoGte is 90', () => {
    const old = { ...baseMovie, added: daysAgo(91) };
    const result = applyMovieFilters([old], { addedDaysAgoGte: 90 });
    expect(result).toHaveLength(1);
  });

  it('excludes a movie added only 10 days ago when addedDaysAgoGte is 90', () => {
    const recent = { ...baseMovie, added: daysAgo(10) };
    const result = applyMovieFilters([recent], { addedDaysAgoGte: 90 });
    expect(result).toHaveLength(0);
  });

  it('excludes a movie with no added field when filter is active', () => {
    const result = applyMovieFilters([baseMovie], { addedDaysAgoGte: 90 });
    expect(result).toHaveLength(0);
  });

  it('matches a series added more than 90 days ago when addedDaysAgoGte is 90', () => {
    const old = { ...baseSeries, added: daysAgo(91) };
    const result = applySeriesFilters([old], { addedDaysAgoGte: 90 });
    expect(result).toHaveLength(1);
  });

  it('excludes a series with no added field when filter is active', () => {
    const result = applySeriesFilters([baseSeries], { addedDaysAgoGte: 90 });
    expect(result).toHaveLength(0);
  });

  it('applies addedDaysAgoLte to cap the upper bound', () => {
    const old = { ...baseMovie, added: daysAgo(200) };
    const medium = { ...baseMovie, id: 2, title: 'Inception', added: daysAgo(50) };
    const result = applyMovieFilters([old, medium], { addedDaysAgoGte: 30, addedDaysAgoLte: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
});

describe('sizeOnDiskGb filter', () => {
  const GB = 1_073_741_824;

  it('matches a movie larger than the minimum GB threshold', () => {
    const large = {
      ...baseMovie,
      statistics: { sizeOnDisk: 10 * GB, movieFileCount: 1, releaseGroups: [] },
    };
    const result = applyMovieFilters([large], { sizeOnDiskGbGte: 5 });
    expect(result).toHaveLength(1);
  });

  it('excludes a movie smaller than the minimum GB threshold', () => {
    const small = {
      ...baseMovie,
      statistics: { sizeOnDisk: 2 * GB, movieFileCount: 1, releaseGroups: [] },
    };
    const result = applyMovieFilters([small], { sizeOnDiskGbGte: 5 });
    expect(result).toHaveLength(0);
  });

  it('excludes a movie with no statistics when filter is active', () => {
    const result = applyMovieFilters([baseMovie], { sizeOnDiskGbGte: 1 });
    expect(result).toHaveLength(0);
  });

  it('applies sizeOnDiskGbLte to cap the upper bound', () => {
    const small = {
      ...baseMovie,
      statistics: { sizeOnDisk: 2 * GB, movieFileCount: 1, releaseGroups: [] },
    };
    const large = {
      ...baseMovie,
      id: 2,
      title: 'Inception',
      statistics: { sizeOnDisk: 10 * GB, movieFileCount: 1, releaseGroups: [] },
    };
    const result = applyMovieFilters([small, large], { sizeOnDiskGbLte: 5 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('matches a series within the GB range', () => {
    const mid = {
      ...baseSeries,
      statistics: {
        sizeOnDisk: 3 * GB,
        seasonCount: 1,
        episodeFileCount: 10,
        episodeCount: 10,
        totalEpisodeCount: 10,
        percentOfEpisodes: 100,
      },
    };
    const result = applySeriesFilters([mid], { sizeOnDiskGbGte: 2, sizeOnDiskGbLte: 5 });
    expect(result).toHaveLength(1);
  });
});

describe('certification filter', () => {
  it('matches a movie with an exact certification (case-insensitive)', () => {
    const rated = { ...baseMovie, certification: 'PG-13' };
    const result = applyMovieFilters([rated], { certification: 'pg-13' });
    expect(result).toHaveLength(1);
  });

  it('excludes a movie with a different certification', () => {
    const rated = { ...baseMovie, certification: 'R' };
    const result = applyMovieFilters([rated], { certification: 'PG-13' });
    expect(result).toHaveLength(0);
  });

  it('excludes a movie with no certification when filter is active', () => {
    const result = applyMovieFilters([baseMovie], { certification: 'PG-13' });
    expect(result).toHaveLength(0);
  });

  it('matches any value in a CSV list (OR semantics)', () => {
    const pg13 = { ...baseMovie, certification: 'PG-13' };
    const r = { ...baseMovie, id: 2, title: 'Fight Club', certification: 'R' };
    const g = { ...baseMovie, id: 3, title: 'Bambi', certification: 'G' };
    const result = applyMovieFilters([pg13, r, g], { certification: 'pg-13,r' });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining([1, 2]));
  });

  it('applies the same logic to series', () => {
    const rated = { ...baseSeries, certification: '15' };
    expect(applySeriesFilters([rated], { certification: '15' })).toHaveLength(1);
    expect(applySeriesFilters([baseSeries], { certification: '15' })).toHaveLength(0);
  });
});

describe('radarrImdbRating filter', () => {
  it('matches a movie with an IMDB rating above the minimum', () => {
    const rated = { ...baseMovie, ratings: { imdb: { value: 8.5, votes: 1000, type: 'user' } } };
    const result = applyMovieFilters([rated], { radarrImdbRatingGte: 8.0 });
    expect(result).toHaveLength(1);
  });

  it('excludes a movie with an IMDB rating below the minimum', () => {
    const rated = { ...baseMovie, ratings: { imdb: { value: 6.0, votes: 500, type: 'user' } } };
    const result = applyMovieFilters([rated], { radarrImdbRatingGte: 8.0 });
    expect(result).toHaveLength(0);
  });

  it('excludes a movie with no ratings when filter is active', () => {
    const result = applyMovieFilters([baseMovie], { radarrImdbRatingGte: 7.0 });
    expect(result).toHaveLength(0);
  });

  it('excludes a movie with ratings but no imdb entry when filter is active', () => {
    const noImdb = { ...baseMovie, ratings: { tmdb: { value: 8.0, votes: 100, type: 'user' } } };
    const result = applyMovieFilters([noImdb], { radarrImdbRatingGte: 7.0 });
    expect(result).toHaveLength(0);
  });

  it('applies radarrImdbRatingLte to cap the upper bound', () => {
    const high = { ...baseMovie, ratings: { imdb: { value: 9.5, votes: 1000, type: 'user' } } };
    const low = {
      ...baseMovie,
      id: 2,
      title: 'Inception',
      ratings: { imdb: { value: 6.0, votes: 500, type: 'user' } },
    };
    const result = applyMovieFilters([high, low], {
      radarrImdbRatingGte: 5.0,
      radarrImdbRatingLte: 7.0,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
});

describe('sonarrRating filter', () => {
  it('matches a series with a rating above the minimum', () => {
    const rated = { ...baseSeries, ratings: { value: 8.5, votes: 1000 } };
    const result = applySeriesFilters([rated], { sonarrRatingGte: 8.0 });
    expect(result).toHaveLength(1);
  });

  it('excludes a series with a rating below the minimum', () => {
    const rated = { ...baseSeries, ratings: { value: 6.0, votes: 500 } };
    const result = applySeriesFilters([rated], { sonarrRatingGte: 8.0 });
    expect(result).toHaveLength(0);
  });

  it('excludes a series with no ratings when filter is active', () => {
    const result = applySeriesFilters([baseSeries], { sonarrRatingGte: 7.0 });
    expect(result).toHaveLength(0);
  });

  it('applies sonarrRatingLte to cap the upper bound', () => {
    const high = { ...baseSeries, ratings: { value: 9.5, votes: 1000 } };
    const mid = {
      ...baseSeries,
      id: 2,
      title: 'Better Call Saul',
      ratings: { value: 7.5, votes: 500 },
    };
    const result = applySeriesFilters([high, mid], { sonarrRatingGte: 6.0, sonarrRatingLte: 8.0 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
});

describe('sonarrEnded filter', () => {
  it('returns only ended series when sonarrEnded is true', () => {
    const ended = { ...baseSeries, ended: true };
    const ongoing = { ...baseSeries, id: 2, title: 'The Boys', ended: false };
    const result = applySeriesFilters([ended, ongoing], { sonarrEnded: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns only ongoing series when sonarrEnded is false', () => {
    const ended = { ...baseSeries, ended: true };
    const ongoing = { ...baseSeries, id: 2, title: 'The Boys', ended: false };
    const result = applySeriesFilters([ended, ongoing], { sonarrEnded: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('excludes a series with no ended field when sonarrEnded is true', () => {
    const result = applySeriesFilters([baseSeries], { sonarrEnded: true });
    expect(result).toHaveLength(0);
  });
});

describe('sonarrLastAiredDaysAgo filter', () => {
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

  it('matches a series whose last episode aired more than 30 days ago', () => {
    const old = { ...baseSeries, previousAiring: daysAgo(40) };
    const result = applySeriesFilters([old], { sonarrLastAiredDaysAgoGte: 30 });
    expect(result).toHaveLength(1);
  });

  it('excludes a series whose last episode aired only 5 days ago', () => {
    const recent = { ...baseSeries, previousAiring: daysAgo(5) };
    const result = applySeriesFilters([recent], { sonarrLastAiredDaysAgoGte: 30 });
    expect(result).toHaveLength(0);
  });

  it('excludes a series with no previousAiring when filter is active', () => {
    const result = applySeriesFilters([baseSeries], { sonarrLastAiredDaysAgoGte: 30 });
    expect(result).toHaveLength(0);
  });

  it('applies sonarrLastAiredDaysAgoLte to cap the upper bound', () => {
    const old = { ...baseSeries, previousAiring: daysAgo(200) };
    const mid = { ...baseSeries, id: 2, title: 'Better Call Saul', previousAiring: daysAgo(60) };
    const result = applySeriesFilters([old, mid], {
      sonarrLastAiredDaysAgoGte: 30,
      sonarrLastAiredDaysAgoLte: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
});

describe('sonarrPercentEpisodes filter', () => {
  const mkStats = (pct: number) => ({
    seasonCount: 1,
    episodeFileCount: 10,
    episodeCount: 10,
    totalEpisodeCount: 10,
    sizeOnDisk: 1_073_741_824,
    percentOfEpisodes: pct,
  });

  it('matches a series with percent episodes above the minimum', () => {
    const complete = { ...baseSeries, statistics: mkStats(100) };
    const result = applySeriesFilters([complete], { sonarrPercentEpisodesGte: 90 });
    expect(result).toHaveLength(1);
  });

  it('excludes a series with percent episodes below the minimum', () => {
    const partial = { ...baseSeries, statistics: mkStats(50) };
    const result = applySeriesFilters([partial], { sonarrPercentEpisodesGte: 90 });
    expect(result).toHaveLength(0);
  });

  it('excludes a series with no statistics when filter is active', () => {
    const result = applySeriesFilters([baseSeries], { sonarrPercentEpisodesGte: 50 });
    expect(result).toHaveLength(0);
  });

  it('applies sonarrPercentEpisodesLte to cap the upper bound', () => {
    const full = { ...baseSeries, statistics: mkStats(100) };
    const partial = { ...baseSeries, id: 2, title: 'Better Call Saul', statistics: mkStats(60) };
    const result = applySeriesFilters([full, partial], {
      sonarrPercentEpisodesGte: 50,
      sonarrPercentEpisodesLte: 80,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
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

  it('filters by seriesTagIds (any match — OR semantics)', () => {
    const seriesList = [
      { ...baseSeries, id: 1, tags: [1, 2] },
      { ...baseSeries, id: 2, title: 'Better Call Saul', tags: [2] },
      { ...baseSeries, id: 3, title: 'Succession', tags: [3] },
    ];
    // Series with tag 1 OR tag 2 should be included; series with only tag 3 is excluded
    const result = applySeriesFilters(seriesList, { seriesTagIds: '1,2' });
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(expect.arrayContaining([1, 2]));
  });
});

describe('applyMovieFilters — Tier 2 enrichment predicates', () => {
  it('excludes movie when tautulliPlayCountGte is set but enrichment row is absent', () => {
    const result = applyMovieFilters(
      [baseMovie],
      { tautulliPlayCountGte: 1 },
      new Map()
    );
    expect(result).toHaveLength(0);
  });

  it('includes movie when tautulliPlayCount satisfies >= threshold', () => {
    const enrichmentMap = new Map([
      [baseMovie.id, { id: 1, mediaIdentityId: 99, tautulliPlayCount: 5, tautulliLastPlayed: null, plexViewCount: null, plexLastViewedAt: null, overseerrRequestStatus: null, overseerrHasIssue: null, tmdbStatus: null, enrichedAt: 1000 }],
    ]);
    const result = applyMovieFilters([baseMovie], { tautulliPlayCountGte: 3 }, enrichmentMap);
    expect(result).toHaveLength(1);
  });

  it('excludes movie when tautulliPlayCount is below threshold', () => {
    const enrichmentMap = new Map([
      [baseMovie.id, { id: 1, mediaIdentityId: 99, tautulliPlayCount: 2, tautulliLastPlayed: null, plexViewCount: null, plexLastViewedAt: null, overseerrRequestStatus: null, overseerrHasIssue: null, tmdbStatus: null, enrichedAt: 1000 }],
    ]);
    const result = applyMovieFilters([baseMovie], { tautulliPlayCountGte: 3 }, enrichmentMap);
    expect(result).toHaveLength(0);
  });
});
