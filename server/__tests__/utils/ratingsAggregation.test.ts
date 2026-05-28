import { aggregateRatings, formatRating, getSummaryText } from '@server/utils/ratingsAggregation';
import { describe, expect, it } from 'vitest';

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
