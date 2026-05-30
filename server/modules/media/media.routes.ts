import { Router } from 'express';
import type { Cradle } from '../../container';
import { isAuthenticated } from '../../middleware/auth';
import { createMediaHandlers } from './media.handler';

export function createMediaRoutes(cradle: Cradle) {
  const router = Router();
  const {
    listMedia,
    listMovies,
    listSeries,
    listTags,
    listQualityProfiles,
    listGenres,
    listNetworks,
  } = createMediaHandlers(cradle);

  router.get('/', isAuthenticated(), listMedia);
  router.get('/movies', isAuthenticated(), listMovies);
  router.get('/series', isAuthenticated(), listSeries);
  router.get('/tags', isAuthenticated(), listTags);
  router.get('/quality-profiles', isAuthenticated(), listQualityProfiles);
  router.get('/genres', isAuthenticated(), listGenres);
  router.get('/networks', isAuthenticated(), listNetworks);

  return router;
}
