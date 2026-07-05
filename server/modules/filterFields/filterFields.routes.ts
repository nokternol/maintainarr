import { Router } from 'express';
import type { Cradle } from '../../container';
import { createFilterFieldsHandlers } from './filterFields.handler';

export function createFilterFieldsRoutes(cradle: Cradle) {
  const router = Router();
  const { getFilterFields } = createFilterFieldsHandlers(cradle);
  router.get('/', getFilterFields);
  return router;
}
