import { Router } from 'express';
import type { Cradle } from '../../container';
import { isAuthenticated } from '../../kernel/middleware/auth';
import { createMediaHandlers } from './media.handler';

export function createMediaRoutes(
  cradle: Cradle,
  handlers?: ReturnType<typeof createMediaHandlers>
) {
  const router = Router();
  const {
    listMovies,
    listSeries,
    listTags,
    listQualityProfiles,
    listGenres,
    listNetworks,
    listStudio,
    listSources,
    resetMedia,
  } = handlers ?? createMediaHandlers(cradle);

  router.get('/sources', isAuthenticated(), listSources);
  router.get('/movies', isAuthenticated(), listMovies);
  router.get('/series', isAuthenticated(), listSeries);
  router.get('/tags', isAuthenticated(), listTags);
  router.get('/quality-profiles', isAuthenticated(), listQualityProfiles);
  router.get('/genres', isAuthenticated(), listGenres);
  router.get('/networks', isAuthenticated(), listNetworks);
  router.get('/studio', isAuthenticated(), listStudio);
  router.delete('/reset', isAuthenticated(), resetMedia);

  return router;
}
