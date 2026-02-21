import { http, HttpResponse } from 'msw';

const SONARR_RESPONSE = {
  type: 'SONARR',
  data: {
    series: [{ id: 1, title: 'Breaking Bad', status: 'ended', monitored: true }],
    qualityProfiles: [{ id: 1, name: 'HD-1080p' }],
    rootFolders: [{ id: 1, path: '/tv', freeSpace: 2000000 }],
    tags: [{ id: 1, label: 'drama' }],
  },
};

const RADARR_RESPONSE = {
  type: 'RADARR',
  data: {
    movies: [{ id: 1, title: 'The Matrix', hasFile: true, monitored: true }],
    qualityProfiles: [{ id: 1, name: 'HD-1080p' }],
    rootFolders: [{ id: 1, path: '/movies', freeSpace: 5000000 }],
    tags: [],
  },
};

const PLEX_RESPONSE = {
  type: 'PLEX',
  data: {
    libraries: [
      { key: '1', title: 'Movies', type: 'movie' },
      { key: '2', title: 'TV Shows', type: 'show' },
    ],
  },
};

const JELLYFIN_RESPONSE = {
  type: 'JELLYFIN',
  data: {
    libraries: [{ Name: 'Movies', ItemId: 'abc123', CollectionType: 'movies' }],
  },
};

const TAUTULLI_RESPONSE = {
  type: 'TAUTULLI',
  data: {
    libraryStats: [{ section_id: 1, section_name: 'Movies', section_type: 'movie', count: 100 }],
    homeStats: [{ stat_id: 'top_movies', rows: [{ title: 'The Matrix', total_plays: 5 }] }],
    recentHistory: [],
  },
};

const OVERSEERR_RESPONSE = {
  type: 'OVERSEERR',
  data: {
    requests: [
      {
        id: 1,
        status: 2,
        type: 'movie',
        requestedBy: { id: 1, displayName: 'Alice', email: 'alice@example.com' },
        media: { tmdbId: 603, title: 'The Matrix' },
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
  },
};

const RESPONSE_BY_TYPE: Record<string, unknown> = {
  SONARR: SONARR_RESPONSE,
  RADARR: RADARR_RESPONSE,
  PLEX: PLEX_RESPONSE,
  JELLYFIN: JELLYFIN_RESPONSE,
  TAUTULLI: TAUTULLI_RESPONSE,
  OVERSEERR: OVERSEERR_RESPONSE,
};

export const providersHandlers = [
  http.get('/api/providers/metadata', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    if (!type || !url.searchParams.get('url')) {
      return HttpResponse.json(
        {
          status: 'error',
          error: { type: 'VALIDATION_ERROR', message: 'Invalid query' },
        },
        { status: 400 }
      );
    }

    const data = RESPONSE_BY_TYPE[type];
    if (!data) {
      return HttpResponse.json(
        { status: 'error', error: { type: 'NOT_FOUND', message: 'Unknown type' } },
        { status: 400 }
      );
    }

    return HttpResponse.json({ status: 'ok', data });
  }),
];
