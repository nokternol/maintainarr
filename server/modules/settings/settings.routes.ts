import { Router } from 'express';
import type { Cradle } from '../../container';
import { createSettingsHandlers } from './settings.handler';

export function createSettingsRoutes(cradle: Cradle) {
  const router = Router();
  const { listProviders, createProvider, updateProvider, deleteProvider, testProvider } =
    createSettingsHandlers(cradle);

  router.get('/providers/test', ...testProvider);
  router.get('/providers', ...listProviders);
  router.post('/providers', ...createProvider);
  router.patch('/providers/:id', ...updateProvider);
  router.delete('/providers/:id', ...deleteProvider);

  return router;
}
