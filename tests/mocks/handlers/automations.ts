import { http, HttpResponse } from 'msw';
import type { AutomationDto } from '@app/hooks/useAutomations';

export const MOCK_AUTOMATIONS: AutomationDto[] = [
  {
    id: 1,
    name: 'Nightly cleanup',
    query: { id: 1, name: 'Unwatched movies', filters: {} as never },
    provider: { id: 1, name: 'Radarr Main', type: 'RADARR' },
    taskId: 'radarr.deleteUnmonitored',
    schedule: '0 2 * * *',
    status: 'active',
    lastRun: { at: '2026-06-03T02:00:00Z', itemCount: 3, status: 'success' },
    nextRun: '2026-06-04T02:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Weekly report',
    query: { id: 2, name: 'All series', filters: {} as never },
    provider: { id: 1, name: 'Radarr Main', type: 'RADARR' },
    taskId: 'radarr.deleteUnmonitored',
    schedule: '0 2 * * 0',
    status: 'active',
    lastRun: { at: '2026-06-01T02:00:00Z', itemCount: 0, status: 'error', error: 'Timeout' },
    nextRun: '2026-06-08T02:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const automationsHandlers = [
  http.get('/api/automations', () => {
    return HttpResponse.json({ status: 'ok', data: MOCK_AUTOMATIONS });
  }),

  http.post('/api/automations', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const created: AutomationDto = {
      id: 99,
      name: String(body.name),
      query: { id: Number(body.queryId), name: 'Query', filters: {} as never },
      provider: { id: Number(body.providerId), name: 'Radarr Main', type: 'RADARR' },
      taskId: String(body.taskId),
      schedule: String(body.schedule),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ status: 'ok', data: created });
  }),

  http.patch('/api/automations/:id/status', async ({ params, request }) => {
    const body = (await request.json()) as { status: 'active' | 'paused' };
    const base = MOCK_AUTOMATIONS.find((a) => a.id === Number(params.id)) ?? MOCK_AUTOMATIONS[0];
    return HttpResponse.json({ status: 'ok', data: { ...base, status: body.status } });
  }),

  http.delete('/api/automations/:id', () => {
    return HttpResponse.json({ status: 'ok', data: null });
  }),
];

export const savedQueriesHandlers = [
  http.get('/api/saved-queries', () => {
    return HttpResponse.json({
      status: 'ok',
      data: [
        { id: 1, name: 'Unwatched movies', filters: {}, createdAt: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'All series', filters: {}, createdAt: '2026-01-01T00:00:00Z' },
      ],
    });
  }),

  http.post('/api/saved-queries', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      status: 'ok',
      data: { id: 99, name: body.name, filters: body.filters, createdAt: new Date().toISOString() },
    });
  }),

  http.delete('/api/saved-queries/:id', () => {
    return HttpResponse.json({ status: 'ok', data: null });
  }),
];
