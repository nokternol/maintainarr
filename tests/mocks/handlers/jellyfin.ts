import { http, HttpResponse } from 'msw';

const JELLYFIN_URL = 'http://localhost:8096';

export const jellyfinHandlers = [
  http.get(`${JELLYFIN_URL}/Library/VirtualFolders`, () => {
    return HttpResponse.json([
      { Name: 'Movies', ItemId: 'aaaaaa', CollectionType: 'movies' },
      { Name: 'TV Shows', ItemId: 'bbbbbb', CollectionType: 'tvshows' },
    ]);
  }),

  http.get(`${JELLYFIN_URL}/Users/:userId/Items`, ({ request }) => {
    const url = new URL(request.url);
    const parentId = url.searchParams.get('ParentId');
    return HttpResponse.json({
      Items: [
        {
          Id: 'item1',
          Name: parentId === 'aaaaaa' ? 'The Matrix' : 'Breaking Bad',
          Type: parentId === 'aaaaaa' ? 'Movie' : 'Series',
          ProductionYear: 1999,
        },
      ],
      TotalRecordCount: 1,
    });
  }),
];
