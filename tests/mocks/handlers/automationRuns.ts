import { http, HttpResponse } from 'msw';

export const mockRuns = [
  {
    id: 1,
    automationId: 1,
    automationName: 'Nightly Cleanup',
    ranAt: '2026-06-04T02:00:00.000Z',
    status: 'success',
    itemCount: 5,
    error: null,
    createdAt: '2026-06-04T02:00:00.000Z',
  },
  {
    id: 2,
    automationId: 1,
    automationName: 'Nightly Cleanup',
    ranAt: '2026-06-03T02:00:00.000Z',
    status: 'error',
    itemCount: 0,
    error: 'Connection refused',
    createdAt: '2026-06-03T02:00:00.000Z',
  },
];

export const automationRunHandlers = [
  http.get('/api/automations/runs', ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const sliced = mockRuns.slice(offset, offset + limit);
    return HttpResponse.json({ status: 'ok', data: { data: sliced, total: mockRuns.length } });
  }),
];
