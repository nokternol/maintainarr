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
    listReleaseGroups,
    listCollectionNames,
    listFileContainers,
    listVideoCodecs,
    listAudioCodecs,
    listFileResolutions,
    listLabels,
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
  router.get('/release-groups', isAuthenticated(), listReleaseGroups);
  router.get('/collection-names', isAuthenticated(), listCollectionNames);
  router.get('/file-containers', isAuthenticated(), listFileContainers);
  router.get('/video-codecs', isAuthenticated(), listVideoCodecs);
  router.get('/audio-codecs', isAuthenticated(), listAudioCodecs);
  router.get('/file-resolutions', isAuthenticated(), listFileResolutions);
  router.get('/labels', isAuthenticated(), listLabels);
  router.delete('/reset', isAuthenticated(), resetMedia);

  return router;
}
