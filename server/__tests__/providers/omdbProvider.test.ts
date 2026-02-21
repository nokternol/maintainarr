import { MetadataProviderType } from '@server/database/entities/MetadataProvider';
import { getChildLogger } from '@server/logger';
import { OmdbProvider } from '@server/providers/omdbProvider';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const log = getChildLogger('TestOmdbProvider');

const mockProvider = {
  id: 1,
  type: MetadataProviderType.OMDB,
  name: 'Test OMDB',
  url: 'https://www.omdbapi.com',
  apiKey: 'test-key',
  settings: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const server = setupServer(
  http.get('https://www.omdbapi.com/', ({ request }) => {
    const url = new URL(request.url);
    const title = url.searchParams.get('t');
    const type = url.searchParams.get('type');

    if (title === 'The Matrix' && type === 'movie') {
      return HttpResponse.json({
        Title: 'The Matrix',
        Year: '1999',
        Type: 'movie',
        imdbID: 'tt0133093',
        imdbRating: '8.7',
        imdbVotes: '1,823,456',
        Ratings: [
          { Source: 'Internet Movie Database', Value: '8.7/10' },
          { Source: 'Rotten Tomatoes', Value: '88%' },
          { Source: 'Metacritic', Value: '73/100' },
        ],
        Response: 'True',
      });
    }

    if (title === 'Breaking Bad' && type === 'series') {
      return HttpResponse.json({
        Title: 'Breaking Bad',
        Year: '2008-2013',
        Type: 'series',
        imdbID: 'tt0903747',
        imdbRating: '9.5',
        imdbVotes: '1,900,000',
        Ratings: [{ Source: 'Internet Movie Database', Value: '9.5/10' }],
        Response: 'True',
      });
    }

    return HttpResponse.json({
      Response: 'False',
      Error: 'Movie not found!',
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('OmdbProvider', () => {
  it('should get movie ratings with all sources', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.source).toBe('omdb');
    expect(rating.found).toBe(true);
    expect(rating.imdbRating).toBe(8.7);
    expect(rating.imdbVotes).toBe(1823456);
    expect(rating.rottenTomatoesRating).toBe(88);
    expect(rating.metacriticRating).toBe(73);
  });

  it('should get TV series ratings', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('Breaking Bad', 2008);

    expect(rating.source).toBe('omdb');
    expect(rating.found).toBe(true);
    expect(rating.imdbRating).toBe(9.5);
    expect(rating.imdbVotes).toBe(1900000);
  });

  it('should return found:false when not found', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('Nonexistent Title');

    expect(rating.source).toBe('omdb');
    expect(rating.found).toBe(false);
    expect(rating.imdbRating).toBeUndefined();
  });

  it('should try series if movie fails', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('Breaking Bad');

    expect(rating.found).toBe(true);
    expect(rating.imdbRating).toBe(9.5);
  });

  it('should handle missing ratings gracefully', async () => {
    server.use(
      http.get('https://www.omdbapi.com/', () => {
        return HttpResponse.json({
          Title: 'Some Show',
          Year: '2020',
          Type: 'movie',
          imdbID: 'tt1234567',
          imdbRating: 'N/A',
          imdbVotes: 'N/A',
          Ratings: [],
          Response: 'True',
        });
      })
    );

    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('Some Show');

    expect(rating.found).toBe(true);
    expect(rating.imdbRating).toBeUndefined();
    expect(rating.rottenTomatoesRating).toBeUndefined();
  });
});
