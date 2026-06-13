import { Router } from 'express';
import type { Cradle } from '../../container';
import { createAutomationHandlers } from './automations.handler';

export function createAutomationRoutes(cradle: Cradle) {
  const router = Router();
  const {
    list,
    create,
    updateStatus,
    delete: del,
    listRuns,
    run,
  } = createAutomationHandlers(cradle);

  router.get('/runs', ...listRuns);
  router.get('/', ...list);
  router.post('/', ...create);
  router.post('/:id/run', ...run);
  router.patch('/:id/status', ...updateStatus);
  router.delete('/:id', ...del);

  return router;
}
