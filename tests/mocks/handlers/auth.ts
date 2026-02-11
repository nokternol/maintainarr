import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      status: 'ok',
      data: {
        id: 1,
        email: 'test@example.com',
        plexUsername: 'testuser',
        plexId: 12345,
        avatar: null,
        userType: 'plex',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  http.post('/api/auth/plex', async ({ request }) => {
    const body = (await request.json()) as { authToken: string };

    if (!body.authToken) {
      return HttpResponse.json(
        { status: 'error', error: { type: 'VALIDATION_ERROR', message: 'Invalid token' } },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      status: 'ok',
      data: {
        id: 1,
        email: 'test@example.com',
        plexUsername: 'testuser',
        plexId: 12345,
        avatar: null,
        userType: 'plex',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({
      status: 'ok',
      data: { success: true },
    });
  }),
];
