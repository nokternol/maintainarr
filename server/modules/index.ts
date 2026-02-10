import { Router } from 'express';
import type { Cradle } from '../container';
import { createHealthRoutes } from './health/health.routes';

/**
 * Creates the API router with all module routes mounted.
 * The cradle provides injected dependencies to every module.
 */
export function createApiRouter(cradle: Cradle) {
  const router = Router();

  router.use('/health', createHealthRoutes(cradle));

  return router;
}
