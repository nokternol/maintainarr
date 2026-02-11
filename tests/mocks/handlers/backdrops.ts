import { http, HttpResponse } from 'msw';

export const backdropsHandlers = [
  http.get('/api/backdrops', () => {
    return HttpResponse.json({
      status: 'ok',
      data: [
        'https://image.tmdb.org/t/p/original/test1.jpg',
        'https://image.tmdb.org/t/p/original/test2.jpg',
      ],
    });
  }),
];
