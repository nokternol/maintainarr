import { http, HttpResponse } from 'msw';

export const backdropsHandlers = [
  http.get('/api/backdrops', () => {
    return HttpResponse.json({
      status: 'ok',
      data: [
        'https://image.tmdb.org/t/p/original/hZkgoQYus5vegHoetLkJoBvHig.jpg',
        'https://image.tmdb.org/t/p/original/9pkZesKASyBiM66J3P90QGg2R12.jpg',
        'https://image.tmdb.org/t/p/original/1XDDXPXGiI8id7MrUxK36ke7gk1.jpg',
        'https://image.tmdb.org/t/p/original/a4I61Lh1d3a1Q2m83A3Z1T33I44.jpg',
        'https://image.tmdb.org/t/p/original/jsoz1HdU2Ebb2ndtyNYV_kyCgS4.jpg',
        'https://image.tmdb.org/t/p/original/572YvGnwLmeIE02aCj2e34Gf40W.jpg',
        'https://image.tmdb.org/t/p/original/x2L3vQp2rQuTjAAbm2gRGr2SDe.jpg',
        'https://image.tmdb.org/t/p/original/jBFxXK6I6uL4lM1yv52jK2Sj1xn.jpg',
        'https://image.tmdb.org/t/p/original/gg2w8QYf6o5elN95Rmflp1Zlpoe.jpg',
        'https://image.tmdb.org/t/p/original/pA3vdhadJPxF5GA1uo83vchZcUA.jpg',
        'https://image.tmdb.org/t/p/original/Anb2s3x4J7lQ90i0rY4A4c43aDc.jpg',
        'https://image.tmdb.org/t/p/original/70Rm9Gjc0hKkIf4KDOc9tJCTtU3.jpg',
        'https://image.tmdb.org/t/p/original/t5zCBSB5xMDKcDqe9gkeA2jhhTz.jpg',
        'https://image.tmdb.org/t/p/original/xgU4iB1gDkcF7rDjp9zQkM0vB3q.jpg',
        'https://image.tmdb.org/t/p/original/fgsHl9Xy7j2c2T45I2d1oALl22S.jpg',
        'https://image.tmdb.org/t/p/original/uW93w2gQW4hCSr00Irm49pT2fko.jpg',
        'https://image.tmdb.org/t/p/original/AdyGzc02G4s491we3nBfJg053f.jpg',
        'https://image.tmdb.org/t/p/original/dKqa8rNlCgI2v9oj2r3iO1D3d9d.jpg',
        'https://image.tmdb.org/t/p/original/zIYROrk3BSya4YVcGuPMV3a3yv.jpg',
        'https://image.tmdb.org/t/p/original/2w5qjittO22dK5zD4kY8g2P8vd2.jpg',
      ],
    });
  }),
];
