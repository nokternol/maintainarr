import { Router } from 'express';
import type { Cradle } from '../../container';
import { createAppSettingsHandlers } from './appSettings.handler';

export function createAppSettingsRoutes(cradle: Cradle) {
  const router = Router();
  const { get, update } = createAppSettingsHandlers(cradle);

  router.get('/', ...get);
  router.patch('/', ...update);

  return router;
}
