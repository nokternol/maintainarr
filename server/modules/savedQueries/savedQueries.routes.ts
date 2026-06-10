import { Router } from 'express';
import type { Cradle } from '../../container';
import { createSavedQueryHandlers } from './savedQueries.handler';

export function createSavedQueryRoutes(cradle: Cradle) {
  const router = Router();
  const { list, create, delete: del, preview } = createSavedQueryHandlers(cradle);

  router.get('/', ...list);
  router.post('/', ...create);
  router.get('/:id/preview', ...preview);
  router.delete('/:id', ...del);

  return router;
}
