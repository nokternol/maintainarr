import { MetadataProviderType } from '@server/database/entities/MetadataProvider';
import { getChildLogger } from '@server/logger';
import { TmdbProvider } from '@server/providers/tmdbProvider';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const log = getChildLogger('TestTmdbProvider');

const mockProvider = {
  id: 1,
  type: MetadataProviderType.TMDB,
  name: 'Test TMDB',
  url: 'https://api.themoviedb.org/3',
  apiKey: 'test-api-key',
  settings: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const server = setupServer(
  http.get('https://api.themoviedb.org/3/search/multi', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (query === 'Breaking Bad') {
      return HttpResponse.json({
        results: [
          {
            id: 1396,
            name: 'Breaking Bad',
            media_type: 'tv',
            vote_average: 8.9,
            vote_count: 5234,
            popularity: 123.45,
            first_air_date: '2008-01-20',
            overview: 'A chemistry teacher...',
          },
        ],
      });
    }

    if (query === 'The Matrix') {
      return HttpResponse.json({
        results: [
          {
            id: 603,
            title: 'The Matrix',
            media_type: 'movie',
            vote_average: 8.7,
            vote_count: 24512,
            popularity: 98.21,
            release_date: '1999-03-31',
            overview: 'A hacker...',
          },
        ],
      });
    }

    return HttpResponse.json({ results: [] });
  }),

  http.get('https://api.themoviedb.org/3/movie/:id', () => {
    return HttpResponse.json({
      id: 603,
      title: 'The Matrix',
      vote_average: 8.7,
      vote_count: 24512,
      popularity: 98.21,
      release_date: '1999-03-31',
      runtime: 136,
      genres: [{ id: 28, name: 'Action' }],
      imdb_id: 'tt0133093',
    });
  }),

  http.get('https://api.themoviedb.org/3/tv/:id', () => {
    return HttpResponse.json({
      id: 1396,
      name: 'Breaking Bad',
      vote_average: 8.9,
      vote_count: 5234,
      popularity: 123.45,
      first_air_date: '2008-01-20',
      number_of_seasons: 5,
      genres: [{ id: 18, name: 'Drama' }],
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('TmdbProvider', () => {
  it('should search for media and return results', async () => {
    const provider = new TmdbProvider(mockProvider, log);
    const results = await provider.search('Breaking Bad');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Breaking Bad');
    expect(results[0].media_type).toBe('tv');
  });

  it('should get TV show ratings', async () => {
    const provider = new TmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('Breaking Bad', 2008);

    expect(rating.source).toBe('tmdb');
    expect(rating.found).toBe(true);
    expect(rating.tvRating).toBe(8.9);
    expect(rating.tvVotes).toBe(5234);
    expect(rating.popularity).toBe(123.45);
  });

  it('should get movie ratings', async () => {
    const provider = new TmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.source).toBe('tmdb');
    expect(rating.found).toBe(true);
    expect(rating.movieRating).toBe(8.7);
    expect(rating.movieVotes).toBe(24512);
    expect(rating.popularity).toBe(98.21);
  });

  it('should return found:false when no results', async () => {
    const provider = new TmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('NonexistentShow12345');

    expect(rating.source).toBe('tmdb');
    expect(rating.found).toBe(false);
    expect(rating.movieRating).toBeUndefined();
    expect(rating.tvRating).toBeUndefined();
  });

  it('should match by year when provided', async () => {
    const provider = new TmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('Breaking Bad', 2008);

    expect(rating.found).toBe(true);
    expect(rating.tvRating).toBe(8.9);
  });
});
