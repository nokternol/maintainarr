import { http, HttpResponse } from 'msw';

const RADARR_URL = 'http://localhost:7878/api/v3';

export const radarrHandlers = [
  http.get(`${RADARR_URL}/movie`, ({ request }) => {
    const url = new URL(request.url);
    if (!url.searchParams.has('apikey') && !request.headers.get('X-Api-Key')) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json([
      {
        id: 1,
        title: 'The Matrix',
        hasFile: true,
        monitored: true,
        tmdbId: 603,
        profileId: 1,
        qualityProfileId: 1,
        tags: [1, 2],
        folderName: '/movies/The Matrix (1999)',
        path: '/movies/The Matrix (1999)',
      },
    ]);
  }),

  http.get(`${RADARR_URL}/qualityprofile`, () => {
    return HttpResponse.json([
      { id: 1, name: 'HD-1080p' },
      { id: 2, name: 'Any' },
    ]);
  }),

  http.get(`${RADARR_URL}/rootfolder`, () => {
    return HttpResponse.json([{ id: 1, path: '/movies', freeSpace: 1000000, unmappedFolders: [] }]);
  }),

  http.get(`${RADARR_URL}/tag`, () => {
    return HttpResponse.json([
      { id: 1, label: 'action' },
      { id: 2, label: 'sci-fi' },
    ]);
  }),
];
