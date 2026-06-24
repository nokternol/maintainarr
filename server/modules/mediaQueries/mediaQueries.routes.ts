import { Router } from 'express';
import type { Cradle } from '../../container';
import { createMediaQueryHandlers } from './mediaQueries.handler';

export function createMediaQueryRoutes(cradle: Cradle) {
  const router = Router();
  const { list, create, delete: del, preview } = createMediaQueryHandlers(cradle);

  router.get('/', ...list);
  router.post('/', ...create);
  router.get('/:id/preview', ...preview);
  router.delete('/:id', ...del);

  return router;
}
