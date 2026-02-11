import type { Cradle } from '@server/container';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { createAuthHandlers } from './auth.handler';

export function createAuthRoutes(cradle: Cradle) {
  const router = Router();
  const { plexLogin, getMe, logout } = createAuthHandlers(cradle);

  router.post('/plex', plexLogin);
  router.get('/me', isAuthenticated(), getMe);
  router.post('/logout', logout);

  return router;
}
