import { Router } from 'express';
import type { Cradle } from '../../container';
import { isAuthenticated } from '../../middleware/auth';
import { createMediaHandlers } from './media.handler';

export function createMediaRoutes(cradle: Cradle) {
  const router = Router();
  const { listMedia } = createMediaHandlers(cradle);

  router.get('/', isAuthenticated(), listMedia);

  return router;
}
