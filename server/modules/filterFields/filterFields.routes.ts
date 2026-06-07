import { Router } from 'express';
import { getFilterFields } from './filterFields.handler';

export function createFilterFieldsRoutes() {
  const router = Router();
  router.get('/', getFilterFields);
  return router;
}
