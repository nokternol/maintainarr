import { Router } from 'express';
import type { Cradle } from '../../container';
import { createHealthHandlers } from './health.handler';

export function createHealthRoutes(cradle: Cradle) {
  const router = Router();
  const { getHealth } = createHealthHandlers(cradle);

  router.get('/', getHealth);

  return router;
}
