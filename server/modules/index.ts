import { Router } from 'express';
import type { Cradle } from '../container';
import { checkUser } from '../kernel/middleware/auth';
import { createAuthRoutes } from './auth/auth.routes';
import { createAutomationRoutes } from './automations/automations.routes';
import { createBackdropsRoutes } from './backdrops/backdrops.routes';
import { createFilterFieldsRoutes } from './filterFields/filterFields.routes';
import { createHealthRoutes } from './health/health.routes';
import { createMediaHandlers } from './media/media.handler';
import { createMediaRoutes } from './media/media.routes';
import { createMediaQueryRoutes } from './mediaQueries/mediaQueries.routes';
import { createProvidersRoutes } from './providers';
import { createSearchRoutes } from './search/search.routes';
import { createSettingsRoutes } from './settings/settings.routes';

/**
 * Creates the API router with all module routes mounted.
 * The cradle provides injected dependencies to every module.
 *
 * Media handlers are built once so their `invalidateMediaCaches` function
 * can be shared with the settings handler — provider mutations bust stale
 * movies/series/tags/profiles/genres/networks cache entries immediately.
 */
export function createApiRouter(cradle: Cradle) {
  const router = Router();

  // Attach user to all requests (if session exists)
  router.use(checkUser);

  // Build media handlers once so the invalidator can be shared.
  const mediaHandlers = createMediaHandlers(cradle);
  const { invalidateMediaCaches } = mediaHandlers;

  // Mount modules
  router.use('/health', createHealthRoutes(cradle));
  router.use('/backdrops', createBackdropsRoutes(cradle));
  router.use('/auth', createAuthRoutes(cradle));
  router.use('/providers', createProvidersRoutes(cradle));
  router.use('/settings', createSettingsRoutes(cradle, invalidateMediaCaches));
  router.use('/media', createMediaRoutes(cradle, mediaHandlers));
  router.use('/search', createSearchRoutes(cradle));
  router.use('/filter-fields', createFilterFieldsRoutes(cradle));
  router.use('/media-queries', createMediaQueryRoutes(cradle));
  router.use('/automations', createAutomationRoutes(cradle));

  return router;
}
