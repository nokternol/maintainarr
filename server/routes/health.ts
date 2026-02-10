import { Router } from 'express';
import { z } from 'zod';
import { getConfig } from '../config';
import { defineRoute } from '../utils/defineRoute';

const router = Router();

router.get(
  '/',
  defineRoute({
    schemas: {
      response: z.object({
        status: z.string(),
        timestamp: z.string(),
        version: z.string(),
        environment: z.string(),
      }),
    },
    handler: async () => {
      const config = getConfig();
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.COMMIT_TAG,
        environment: config.NODE_ENV,
      };
    },
  })
);

export default router;
