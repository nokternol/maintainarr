import { defineRoute } from '@server/kernel/defineRoute';
import { isAuthenticated } from '@server/kernel/middleware/auth';
import { z } from 'zod';
import { appSettingsSchemas } from './appSettings.schemas';
import type { AppSettingsService } from './appSettingsService';

interface Cradle {
  appSettingsService: AppSettingsService;
}

const responseSchema = z.object({
  region: z.string().nullable(),
  primaryMediaServer: z.enum(['PLEX', 'JELLYFIN']),
});

export function createAppSettingsHandlers({ appSettingsService }: Cradle) {
  return {
    get: [
      isAuthenticated(),
      defineRoute({
        schemas: { response: responseSchema },
        handler: async () => appSettingsService.get(),
      }),
    ],

    update: [
      isAuthenticated(),
      defineRoute({
        schemas: { ...appSettingsSchemas.update, response: responseSchema },
        handler: async ({ body }) =>
          appSettingsService.update({
            region: body.region as string | null | undefined,
            primaryMediaServer: body.primaryMediaServer as 'PLEX' | 'JELLYFIN' | undefined,
          }),
      }),
    ],
  };
}
