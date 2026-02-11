import { Router } from 'express';
import type { Cradle } from '../container';
import { checkUser } from '../middleware/auth';
import { createAuthRoutes } from './auth/auth.routes';
import { createBackdropsRoutes } from './backdrops/backdrops.routes';
import { createHealthRoutes } from './health/health.routes';

/**
 * Creates the API router with all module routes mounted.
 * The cradle provides injected dependencies to every module.
 */
export function createApiRouter(cradle: Cradle) {
  const router = Router();

  // Attach user to all requests (if session exists)
  router.use(checkUser);

  // Mount modules
  router.use('/health', createHealthRoutes(cradle));
  router.use('/backdrops', createBackdropsRoutes(cradle));
  router.use('/auth', createAuthRoutes(cradle));

  return router;
}
