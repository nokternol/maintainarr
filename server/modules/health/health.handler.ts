import type { AppConfig } from '../../config';
import { defineRoute } from '../../utils/defineRoute';
import { healthSchemas } from './health.schemas';

export function createHealthHandlers({ config }: { config: AppConfig }) {
  return {
    getHealth: defineRoute({
      schemas: healthSchemas.getHealth,
      handler: async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.COMMIT_TAG,
        environment: config.NODE_ENV,
      }),
    }),
  };
}
