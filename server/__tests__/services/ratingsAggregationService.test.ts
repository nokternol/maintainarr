import { RatingsAggregationService } from '@server/services/ratingsAggregationService';
import { describe, expect, it } from 'vitest';

describe('RatingsAggregationService', () => {
  const service = new RatingsAggregationService();

  it('should aggregate ratings from all sources', () => {
    const result = service.aggregate(
      'Breaking Bad',
      2008,
      { source: 'tmdb', tvRating: 8.9, tvVotes: 5234, popularity: 123, found: true },
      { source: 'omdb', imdbRating: 9.5, imdbVotes: 180000, found: true },
      { source: 'tvmaze', rating: 9.1, found: true }
    );

    expect(result.title).toBe('Breaking Bad');
    expect(result.year).toBe(2008);
    expect(result.summary.totalSources).toBe(3);
    expect(result.summary.foundSources).toBe(3);
    expect(result.summary.averageRating).toBe(9.17);
  });

  it('should handle missing sources', () => {
    const result = service.aggregate(
      'Test',
      undefined,
      { source: 'tmdb', found: false },
      { source: 'omdb', imdbRating: 8.0, imdbVotes: 1000, found: true },
      undefined
    );

    expect(result.summary.totalSources).toBe(2);
    expect(result.summary.foundSources).toBe(1);
    expect(result.summary.averageRating).toBe(8.0);
  });

  it('should format ratings correctly', () => {
    expect(service.formatRating(8.5)).toBe('8.5/10');
    expect(service.formatRating(undefined)).toBe('N/A');
  });

  it('should generate summary text', () => {
    const result = service.aggregate(
      'Test',
      undefined,
      { source: 'tmdb', tvRating: 8.0, tvVotes: 100, found: true },
      { source: 'omdb', found: false },
      undefined
    );

    const summary = service.getSummary(result);
    expect(summary).toContain('8.0/10');
    expect(summary).toContain('1/2');
  });
});
