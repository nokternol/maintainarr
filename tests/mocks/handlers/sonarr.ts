import { http, HttpResponse } from 'msw';

const SONARR_URL = 'http://localhost:8989/api/v3';

export const sonarrHandlers = [
  http.get(`${SONARR_URL}/series`, () => {
    return HttpResponse.json([
      {
        id: 1,
        title: 'Breaking Bad',
        status: 'ended',
        monitored: true,
        tvdbId: 81189,
        profileId: 1,
        qualityProfileId: 1,
        languageProfileId: 1,
        tags: [1],
        path: '/tv/Breaking Bad',
        seasons: [{ seasonNumber: 1, monitored: true }],
      },
    ]);
  }),

  http.get(`${SONARR_URL}/qualityprofile`, () => {
    return HttpResponse.json([
      { id: 1, name: 'HD-1080p' },
      { id: 2, name: 'Any' },
    ]);
  }),

  http.get(`${SONARR_URL}/rootfolder`, () => {
    return HttpResponse.json([{ id: 1, path: '/tv', freeSpace: 2000000, unmappedFolders: [] }]);
  }),

  http.get(`${SONARR_URL}/tag`, () => {
    return HttpResponse.json([{ id: 1, label: 'drama' }]);
  }),
];
