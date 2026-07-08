import { getChildLogger } from '@server/kernel/logger';
import type { ProviderConfig } from '@server/providers/baseProviderConnection';
import { OmdbProvider } from '@server/providers/omdbProvider';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const log = getChildLogger('TestOmdbProvider');

const mockProvider: ProviderConfig = {
  name: 'Test OMDB',
  url: 'https://www.omdbapi.com',
  apiKey: 'test-key',
  settings: null,
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
        Awards: 'Won 4 Oscars. 37 wins & 51 nominations.',
        Director: 'Lana Wachowski, Lilly Wachowski',
        Actors: 'Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss',
        Language: 'English',
        Country: 'United States, Australia',
        BoxOffice: '$171,479,930',
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

  it('should include imdbId from the OMDB response', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.imdbId).toBe('tt0133093');
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

  it('should set awardWinner:true when Awards contains "Won"', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.awardWinner).toBe(true);
  });

  it('should set oscarWinner:true when Awards mentions winning an Oscar', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.oscarWinner).toBe(true);
  });

  it('should populate director from Director field', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.director).toBe('Lana Wachowski, Lilly Wachowski');
  });

  it('should populate actors from Actors field', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.actors).toBe('Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss');
  });

  it('should populate language from Language field', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.language).toBe('English');
  });

  it('should parse boxOffice from BoxOffice field', async () => {
    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('The Matrix', 1999);

    expect(rating.boxOffice).toBe(171479930);
  });

  it('should set awardWinner:false when Awards is "N/A"', async () => {
    server.use(
      http.get('https://www.omdbapi.com/', () => {
        return HttpResponse.json({
          Title: 'No Awards Film',
          Year: '2020',
          Type: 'movie',
          imdbID: 'tt9999999',
          imdbRating: '6.0',
          imdbVotes: '1,000',
          Ratings: [],
          Awards: 'N/A',
          Response: 'True',
        });
      })
    );

    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('No Awards Film', 2020);

    expect(rating.awardWinner).toBe(false);
  });

  it('should set oscarWinner:false and awardWinner:false when Awards has nominations only', async () => {
    server.use(
      http.get('https://www.omdbapi.com/', () => {
        return HttpResponse.json({
          Title: 'Nominations Only',
          Year: '2021',
          Type: 'movie',
          imdbID: 'tt8888888',
          imdbRating: '7.0',
          imdbVotes: '500',
          Ratings: [],
          Awards: '2 nominations.',
          Response: 'True',
        });
      })
    );

    const provider = new OmdbProvider(mockProvider, log);
    const rating = await provider.getRatings('Nominations Only', 2021);

    expect(rating.oscarWinner).toBe(false);
    expect(rating.awardWinner).toBe(false);
  });
});
