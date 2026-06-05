import { aggregateRatings, formatRating, getSummaryText } from '@server/utils/ratingsAggregation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('aggregateRatings — ids block', () => {
  it('populates ids.tmdbId and ids.imdbId from a found TMDB result', () => {
    const result = aggregateRatings(
      'The Shawshank Redemption',
      1994,
      { source: 'tmdb', tmdbId: 278, imdbId: 'tt0111161', mediaType: 'movie', found: true },
      undefined,
      undefined
    );

    expect(result.ids.tmdbId).toBe(278);
    expect(result.ids.imdbId).toBe('tt0111161');
  });

  it('populates ids.tvMazeId and ids.tvdbId from a found TVMaze result', () => {
    const result = aggregateRatings('Breaking Bad', 2008, undefined, undefined, {
      source: 'tvmaze',
      tvMazeId: 169,
      tvdbId: 81189,
      imdbId: 'tt0903747',
      rating: 9.1,
      found: true,
    });

    expect(result.ids.tvMazeId).toBe(169);
    expect(result.ids.tvdbId).toBe(81189);
  });

  it('falls back to ids.imdbId from OMDB when TMDB has no imdbId', () => {
    const result = aggregateRatings(
      'Breaking Bad',
      2008,
      { source: 'tmdb', tmdbId: 1396, mediaType: 'tv', found: true },
      { source: 'omdb', imdbId: 'tt0903747', imdbRating: 9.5, found: true },
      undefined
    );

    expect(result.ids.imdbId).toBe('tt0903747');
  });

  it('emits console.warn and uses TMDB imdbId when TMDB and OMDB imdbId values disagree', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = aggregateRatings(
      'Ambiguous Title',
      2000,
      { source: 'tmdb', tmdbId: 123, imdbId: 'tt0111161', mediaType: 'movie', found: true },
      { source: 'omdb', imdbId: 'tt9999999', imdbRating: 7.0, found: true },
      undefined
    );

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('imdbId mismatch');
    expect(result.ids.imdbId).toBe('tt0111161');

    warnSpy.mockRestore();
  });
});

describe('aggregateRatings', () => {
  it('counts all provided sources toward totalSources', () => {
    const result = aggregateRatings(
      'Breaking Bad',
      2008,
      { source: 'tmdb', tvRating: 8.9, tvVotes: 5234, popularity: 123, found: true },
      { source: 'omdb', imdbRating: 9.5, imdbVotes: 180000, found: true },
      { source: 'tvmaze', rating: 9.1, found: true }
    );

    expect(result.summary.totalSources).toBe(3);
  });

  it('counts only sources where found=true toward foundSources', () => {
    const result = aggregateRatings(
      'Test',
      undefined,
      { source: 'tmdb', found: false },
      { source: 'omdb', imdbRating: 8.0, imdbVotes: 1000, found: true },
      undefined
    );

    expect(result.summary.totalSources).toBe(2);
    expect(result.summary.foundSources).toBe(1);
  });

  it('averages numeric ratings from found sources', () => {
    const result = aggregateRatings(
      'Breaking Bad',
      2008,
      { source: 'tmdb', tvRating: 8.9, tvVotes: 5234, popularity: 123, found: true },
      { source: 'omdb', imdbRating: 9.5, imdbVotes: 180000, found: true },
      { source: 'tvmaze', rating: 9.1, found: true }
    );

    expect(result.summary.averageRating).toBe(9.17);
  });

  it('uses movieRating over tvRating for TMDB when both present', () => {
    const result = aggregateRatings(
      'Inception',
      2010,
      { source: 'tmdb', movieRating: 8.8, tvRating: 7.0, found: true },
      undefined,
      undefined
    );

    expect(result.summary.averageRating).toBe(8.8);
  });

  it('leaves averageRating undefined when no found source has a numeric value', () => {
    const result = aggregateRatings(
      'Ghost',
      undefined,
      { source: 'tmdb', found: false },
      undefined,
      undefined
    );

    expect(result.summary.averageRating).toBeUndefined();
  });

  it('passes title and year through to the result', () => {
    const result = aggregateRatings('Dune', 2021);
    expect(result.title).toBe('Dune');
    expect(result.year).toBe(2021);
  });
});

describe('formatRating', () => {
  it('formats a number as value/maxScale with one decimal place', () => {
    expect(formatRating(8.5)).toBe('8.5/10');
  });

  it('respects a custom maxScale', () => {
    expect(formatRating(5, 5)).toBe('5.0/5');
  });

  it('returns N/A for undefined', () => {
    expect(formatRating(undefined)).toBe('N/A');
  });
});

describe('getSummaryText', () => {
  it('reports no ratings found when foundSources is 0', () => {
    const aggregated = aggregateRatings(
      'Unknown',
      undefined,
      { source: 'tmdb', found: false },
      { source: 'omdb', found: false },
      undefined
    );

    expect(getSummaryText(aggregated)).toBe('No ratings found from 2 source(s)');
  });

  it('includes formatted average and source counts when ratings exist', () => {
    const aggregated = aggregateRatings(
      'Test',
      undefined,
      { source: 'tmdb', tvRating: 8.0, tvVotes: 100, found: true },
      { source: 'omdb', found: false },
      undefined
    );

    const summary = getSummaryText(aggregated);
    expect(summary).toContain('8.0/10');
    expect(summary).toContain('1/2');
  });
});
