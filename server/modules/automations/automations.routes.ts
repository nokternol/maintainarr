import { Router } from 'express';
import type { Cradle } from '../../container';
import { createAutomationHandlers } from './automations.handler';

export function createAutomationRoutes(cradle: Cradle) {
  const router = Router();
  const { list, create, updateStatus, delete: del } = createAutomationHandlers(cradle);

  router.get('/', ...list);
  router.post('/', ...create);
  router.patch('/:id/status', ...updateStatus);
  router.delete('/:id', ...del);

  return router;
}
