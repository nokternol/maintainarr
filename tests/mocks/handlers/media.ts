import { http, HttpResponse } from 'msw';

export const mediaHandlers = [
  http.get('/api/media', () => {
    return HttpResponse.json({
      status: 'ok',
      data: {
        movies: [
          {
            id: 1,
            title: 'The Matrix',
            year: 1999,
            hasFile: true,
            monitored: true,
            tmdbId: 603,
            profileId: 1,
            qualityProfileId: 1,
            tags: [],
            folderName: '/movies/The Matrix (1999)',
            path: '/movies/The Matrix (1999)',
            images: [{ coverType: 'poster', remoteUrl: 'https://example.com/matrix.jpg' }],
          },
        ],
        series: [
          {
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
            seasons: [{ seasonNumber: 1, monitored: true }],
            images: [{ coverType: 'poster', remoteUrl: 'https://example.com/bb.jpg' }],
          },
        ],
        errors: [],
      },
    });
  }),
];
