import { http, HttpResponse } from 'msw';

const PLEX_URL = 'http://localhost:32400';

export const plexProviderHandlers = [
  http.get(`${PLEX_URL}/library/sections`, () => {
    return HttpResponse.json({
      MediaContainer: {
        Directory: [
          { key: '1', title: 'Movies', type: 'movie' },
          { key: '2', title: 'TV Shows', type: 'show' },
        ],
      },
    });
  }),

  http.get(`${PLEX_URL}/library/sections/:key/all`, ({ params }) => {
    const isMovies = params.key === '1';
    return HttpResponse.json({
      MediaContainer: {
        Metadata: [
          {
            ratingKey: isMovies ? '101' : '201',
            title: isMovies ? 'The Matrix' : 'Breaking Bad',
            type: isMovies ? 'movie' : 'show',
            year: isMovies ? 1999 : 2008,
          },
        ],
      },
    });
  }),
];
