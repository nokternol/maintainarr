import { Router } from 'express';
import type { Cradle } from '../../container';
import { isAuthenticated } from '../../middleware/auth';
import { createMediaHandlers } from './media.handler';

export function createMediaRoutes(cradle: Cradle) {
  const router = Router();
  const { listMedia, listMovies, listSeries } = createMediaHandlers(cradle);

  router.get('/', isAuthenticated(), listMedia);
  router.get('/movies', isAuthenticated(), listMovies);
  router.get('/series', isAuthenticated(), listSeries);

  return router;
}
