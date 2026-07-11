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

  http.get('/api/media/genres', () => {
    return HttpResponse.json({
      status: 'ok',
      data: {
        movies: ['Action', 'Comedy', 'Crime', 'Drama', 'Horror', 'Sci-Fi', 'Thriller'],
        series: ['Animation', 'Comedy', 'Crime', 'Drama', 'Reality', 'Sci-Fi'],
      },
    });
  }),

  http.get('/api/media/networks', () => {
    return HttpResponse.json({
      status: 'ok',
      data: ['HBO', 'Netflix', 'Apple TV+', 'Disney+', 'AMC'],
    });
  }),

  // Mirrors GET /api/media/sources' ownership projection (sourceOwnership in
  // server/providers/mediaSourceFactory.ts) — configured state matches the
  // default settings.ts fixture (RADARR active, no SONARR).
  http.get('/api/media/sources', () => {
    return HttpResponse.json({
      status: 'ok',
      data: [
        {
          contentType: 'movie',
          ownerType: 'RADARR',
          configured: true,
          instances: [{ id: 1, name: 'Radarr' }],
        },
        { contentType: 'show', ownerType: 'SONARR', configured: false, instances: [] },
      ],
    });
  }),

  // Mirrors GET /api/filter-fields' provider-gated MediaRuleDescriptor projection
  // (server/modules/media/filterRegistry.ts) — the default set every RADARR+SONARR test
  // fixture implies is configured, per providers.ts's default handler.
  http.get('/api/filter-fields', () => {
    return HttpResponse.json([
      {
        key: 'title',
        label: 'Title',
        contentTypes: ['movie', 'show'],
        dataType: 'string',
        sourceProviders: ['RADARR', 'SONARR', 'PLEX'],
        required: false,
      },
      {
        key: 'year',
        label: 'Year',
        contentTypes: ['movie', 'show'],
        dataType: 'range',
        sourceProviders: ['RADARR', 'SONARR', 'PLEX', 'TMDB'],
        required: false,
      },
      {
        key: 'watched',
        label: 'Watched',
        contentTypes: ['movie', 'show'],
        dataType: 'boolean',
        sourceProviders: ['TAUTULLI', 'PLEX'],
        required: false,
      },
      {
        key: 'addedDaysAgo',
        label: 'Added (days ago)',
        contentTypes: ['movie', 'show'],
        dataType: 'range',
        sourceProviders: ['RADARR', 'SONARR', 'PLEX'],
        required: false,
      },
      {
        key: 'sizeOnDiskGb',
        label: 'Size on disk (GB)',
        contentTypes: ['movie', 'show'],
        dataType: 'range',
        sourceProviders: ['RADARR', 'SONARR'],
        required: false,
      },
      {
        key: 'certification',
        label: 'Certification',
        contentTypes: ['movie', 'show'],
        dataType: 'csv-strings',
        sourceProviders: ['RADARR', 'SONARR', 'TMDB', 'OMDB'],
        required: false,
      },
      {
        key: 'hasFile',
        label: 'Has file',
        contentTypes: ['movie', 'show'],
        dataType: 'boolean',
        sourceProviders: ['RADARR', 'SONARR', 'PLEX'],
        required: false,
      },
      {
        key: 'tagIds',
        label: 'Tags',
        contentTypes: ['movie'],
        dataType: 'csv-ids',
        sourceProviders: ['RADARR'],
        required: false,
      },
      {
        key: 'qualityProfileIds',
        label: 'Quality profile',
        contentTypes: ['movie'],
        dataType: 'csv-ids',
        sourceProviders: ['RADARR'],
        required: false,
      },
      {
        key: 'genres',
        label: 'Genres',
        contentTypes: ['movie'],
        dataType: 'csv-strings',
        sourceProviders: ['RADARR', 'TMDB'],
        required: false,
      },
      {
        key: 'imdbRating',
        label: 'IMDB rating',
        contentTypes: ['movie'],
        dataType: 'range',
        sourceProviders: ['RADARR', 'OMDB'],
        required: false,
      },
      {
        key: 'monitored',
        label: 'Monitored',
        contentTypes: ['show'],
        dataType: 'boolean',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'seriesStatus',
        label: 'Series status',
        contentTypes: ['show'],
        dataType: 'string',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'tagIds',
        label: 'Tags',
        contentTypes: ['show'],
        dataType: 'csv-ids',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'qualityProfileIds',
        label: 'Quality profile',
        contentTypes: ['show'],
        dataType: 'csv-ids',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'genres',
        label: 'Genres',
        contentTypes: ['show'],
        dataType: 'csv-strings',
        sourceProviders: ['SONARR', 'TMDB'],
        required: false,
      },
      {
        key: 'seriesType',
        label: 'Series type',
        contentTypes: ['show'],
        dataType: 'string',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'network',
        label: 'Network',
        contentTypes: ['show'],
        dataType: 'csv-strings',
        sourceProviders: ['SONARR', 'TVMAZE'],
        required: false,
      },
      {
        key: 'communityRating',
        label: 'Community rating',
        contentTypes: ['show'],
        dataType: 'range',
        sourceProviders: ['SONARR', 'TMDB'],
        required: false,
      },
      {
        key: 'ended',
        label: 'Ended',
        contentTypes: ['show'],
        dataType: 'boolean',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'lastAiredDaysAgo',
        label: 'Last aired (days ago)',
        contentTypes: ['show'],
        dataType: 'range',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'episodePercentage',
        label: 'Episode completion (%)',
        contentTypes: ['show'],
        dataType: 'range',
        sourceProviders: ['SONARR'],
        required: false,
      },
      {
        key: 'tmdbStatus',
        label: 'TMDB status',
        contentTypes: ['movie', 'show'],
        dataType: 'string',
        sourceProviders: ['TMDB'],
        required: false,
      },
      {
        key: 'overseerrRequestStatus',
        label: 'Overseerr request status',
        contentTypes: ['movie', 'show'],
        dataType: 'number',
        sourceProviders: ['OVERSEERR'],
        required: false,
      },
      {
        key: 'overseerrHasIssue',
        label: 'Overseerr has issue',
        contentTypes: ['movie', 'show'],
        dataType: 'boolean',
        sourceProviders: ['OVERSEERR'],
        required: false,
      },
      {
        key: 'lastWatchedDaysAgo',
        label: 'Last watched (days ago)',
        contentTypes: ['movie', 'show'],
        dataType: 'range',
        sourceProviders: ['TAUTULLI', 'PLEX'],
        required: false,
      },
    ]);
  }),
];
