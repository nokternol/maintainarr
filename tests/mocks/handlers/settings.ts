import { http, HttpResponse } from 'msw';

const mockProviders = [
  {
    id: 1,
    type: 'RADARR',
    name: 'Radarr Main',
    url: 'http://localhost:7878/api/v3',
    apiKey: '***',
    settings: null,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

export const settingsHandlers = [
  http.get('/api/settings/providers', () => {
    return HttpResponse.json({ status: 'ok', data: mockProviders });
  }),

  http.post('/api/settings/providers', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      status: 'ok',
      data: {
        id: 2,
        type: body.type,
        name: body.name,
        url: body.url,
        apiKey: body.apiKey ? '***' : null,
        settings: null,
        isActive: body.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  http.patch('/api/settings/providers/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      status: 'ok',
      data: {
        ...mockProviders[0],
        id: Number(params.id),
        ...body,
        apiKey: '***',
      },
    });
  }),

  http.delete('/api/settings/providers/:id', () => {
    return HttpResponse.json({ status: 'ok', data: null });
  }),
];
