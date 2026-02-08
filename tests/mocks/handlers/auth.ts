import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.get('/api/v1/auth/me', () => {
    return HttpResponse.json({
      id: 1,
      email: 'test@maintainarr.local',
      username: 'testuser',
      displayName: 'Test User',
    });
  }),

  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 1,
      email: body.email,
      username: 'testuser',
      displayName: 'Test User',
    });
  }),

  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),
];
