import { Router } from 'express';
import type { Cradle } from '../../container';
import { createProvidersHandlers } from './providers.handler';

export function createProvidersRoutes(cradle: Cradle) {
  const router = Router();
  const { getTasks, getMetadata, getRatings, getTaskOptions } = createProvidersHandlers(cradle);

  // No isAuthenticated guard — this is a dev/config-time endpoint.
  // Add auth when the feature moves beyond the playground stage.
  router.get('/tasks', getTasks);
  router.get('/task-options/:route', getTaskOptions);
  router.get('/metadata', getMetadata);
  router.get('/ratings', getRatings);

  return router;
}
