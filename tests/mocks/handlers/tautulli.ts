import { http, HttpResponse } from 'msw';

const TAUTULLI_URL = 'http://localhost:8181';

export const tautulliHandlers = [
  http.get(`${TAUTULLI_URL}/api/v2`, ({ request }) => {
    const url = new URL(request.url);
    const cmd = url.searchParams.get('cmd');

    if (cmd === 'get_libraries_table') {
      return HttpResponse.json({
        response: {
          result: 'success',
          data: {
            data: [
              { section_id: 1, section_name: 'Movies', section_type: 'movie', count: 100 },
              { section_id: 2, section_name: 'TV Shows', section_type: 'show', count: 50 },
            ],
          },
        },
      });
    }

    if (cmd === 'get_home_stats') {
      return HttpResponse.json({
        response: {
          result: 'success',
          data: [{ stat_id: 'top_movies', rows: [{ title: 'The Matrix', total_plays: 10 }] }],
        },
      });
    }

    if (cmd === 'get_history') {
      return HttpResponse.json({
        response: {
          result: 'success',
          data: {
            data: [
              {
                rating_key: '123',
                title: 'The Matrix',
                user: 'testuser',
                watched_status: 1,
                duration: 7380,
                play_duration: 7380,
              },
            ],
            total_count: 1,
          },
        },
      });
    }

    return HttpResponse.json(
      { response: { result: 'error', message: 'Unknown command' } },
      { status: 400 }
    );
  }),
];
