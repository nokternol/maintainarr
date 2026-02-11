import type { Cradle } from '@server/container';
import { Router } from 'express';
import { createBackdropsHandlers } from './backdrops.handler';

export function createBackdropsRoutes(cradle: Cradle) {
  const router = Router();
  const { getBackdrops } = createBackdropsHandlers(cradle);

  router.get('/', getBackdrops);

  return router;
}
