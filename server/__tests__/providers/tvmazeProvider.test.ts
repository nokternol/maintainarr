import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { TvMazeProvider } from '@server/providers/tvmazeProvider';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const log = getChildLogger('TestTvMazeProvider');

const mockProvider = {
  id: 1,
  type: MetadataProviderType.TVMAZE,
  name: 'Test TVMaze',
  url: 'https://api.tvmaze.com',
  apiKey: '',
  settings: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const server = setupServer(
  http.get('https://api.tvmaze.com/search/shows', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (query === 'Breaking Bad') {
      return HttpResponse.json([
        {
          score: 0.95,
          show: {
            id: 169,
            name: 'Breaking Bad',
            type: 'Scripted',
            language: 'English',
            genres: ['Drama', 'Crime'],
            status: 'Ended',
            premiered: '2008-01-20',
            rating: { average: 9.1 },
            network: { name: 'AMC', country: { name: 'United States' } },
            externals: { tvrage: 18164, thetvdb: 81189, imdb: 'tt0903747' },
          },
        },
      ]);
    }

    return HttpResponse.json([]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('TvMazeProvider', () => {
  it('should search for shows', async () => {
    const provider = new TvMazeProvider(mockProvider, log);
    const results = await provider.search('Breaking Bad');

    expect(results).toHaveLength(1);
    expect(results[0].show.name).toBe('Breaking Bad');
  });

  it('should get TV show ratings', async () => {
    const provider = new TvMazeProvider(mockProvider, log);
    const rating = await provider.getRatings('Breaking Bad', 2008);

    expect(rating.source).toBe('tvmaze');
    expect(rating.found).toBe(true);
    expect(rating.rating).toBe(9.1);
  });

  it('should return found:false when not found', async () => {
    const provider = new TvMazeProvider(mockProvider, log);
    const rating = await provider.getRatings('Nonexistent Show');

    expect(rating.source).toBe('tvmaze');
    expect(rating.found).toBe(false);
  });
});
