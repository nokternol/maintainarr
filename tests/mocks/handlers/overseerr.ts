import { http, HttpResponse } from 'msw';

// Shared request list shape used by both Overseerr and Seerr
const mockRequests = [
  {
    id: 1,
    status: 2,
    type: 'movie',
    requestedBy: { id: 1, displayName: 'testuser', email: 'test@example.com' },
    media: { tmdbId: 603, title: 'The Matrix' },
    createdAt: new Date().toISOString(),
  },
];

export const overseerrHandlers = [
  http.get('http://localhost:5055/api/v1/request', () => {
    return HttpResponse.json({
      results: mockRequests,
      pageInfo: { pages: 1, pageSize: 20, results: 1, page: 1 },
    });
  }),

  // Seerr (typically runs on a different port but uses same API shape)
  http.get('http://localhost:5056/api/v1/request', () => {
    return HttpResponse.json({
      results: mockRequests,
      pageInfo: { pages: 1, pageSize: 20, results: 1, page: 1 },
    });
  }),
];
