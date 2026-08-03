import { z } from 'zod';

export const appSettingsSchemas = {
  update: {
    body: z.object({
      region: z
        .string()
        .regex(/^[A-Z]{2}$/, 'region must be an ISO 3166-1 alpha-2 code')
        .nullable()
        .optional(),
      primaryMediaServer: z.enum(['PLEX', 'JELLYFIN']).optional(),
    }),
  },
};

export type UpdateAppSettingsBody = z.infer<typeof appSettingsSchemas.update.body>;
