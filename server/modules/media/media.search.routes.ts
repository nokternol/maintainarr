import { Router } from 'express';
import type { Cradle } from '../../container';
import { createSearchHandlers } from './media.search.handler';

export function createSearchRoutes(cradle: Cradle) {
  const router = Router();
  const { searchMetadata } = createSearchHandlers(cradle);

  router.get('/metadata', ...searchMetadata);

  return router;
}
