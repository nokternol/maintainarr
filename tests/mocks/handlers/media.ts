import { http, HttpResponse } from 'msw';

const MOCK_MOVIES = Array.from({ length: 96 }, (_, i) => ({
  id: i + 1,
  title: `Movie ${i + 1}`,
  year: 2000 + (i % 30),
  hasFile: i % 2 === 0,
  monitored: true,
  tmdbId: 1000 + i,
  images: [{ coverType: 'poster', remoteUrl: `https://example.com/movie${i + 1}.jpg` }],
}));

const MOCK_SERIES = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: i === 0 ? 'Breaking Bad' : `Series ${i + 1}`,
  year: 2008 + i,
  status: 'ended',
  monitored: true,
  tvdbId: 81189 + i,
  images: [{ coverType: 'poster', remoteUrl: `https://example.com/series${i + 1}.jpg` }],
}));

export const mediaHandlers = [
  http.get('/api/media/movies', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '48');
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      status: 'ok',
      data: {
        items: MOCK_MOVIES.slice(start, start + pageSize),
        totalCount: MOCK_MOVIES.length,
        page,
        pageSize,
        yearRange: { min: 2000, max: 2029 },
      },
    });
  }),

  http.get('/api/media/series', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '48');
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      status: 'ok',
      data: {
        items: MOCK_SERIES.slice(start, start + pageSize),
        totalCount: MOCK_SERIES.length,
        page,
        pageSize,
        yearRange: { min: 2008, max: 2017 },
      },
    });
  }),

  http.get('/api/media/tags', () => {
    return HttpResponse.json({
      status: 'ok',
      data: {
        radarr: [
          { id: 1, label: 'action' },
          { id: 2, label: 'sci-fi' },
        ],
        sonarr: [{ id: 1, label: 'drama' }],
      },
    });
  }),

  http.get('/api/media/quality-profiles', () => {
    return HttpResponse.json({
      status: 'ok',
      data: {
        radarr: [
          { id: 1, name: 'HD-1080p' },
          { id: 2, name: 'Any' },
        ],
        sonarr: [
          { id: 1, name: 'HD-1080p' },
          { id: 2, name: 'Any' },
        ],
      },
    });
  }),

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
