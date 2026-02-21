import { MetadataProviderType } from '@server/database/entities/MetadataProvider';
import { z } from 'zod';

const providerType = z.nativeEnum(MetadataProviderType);

export const providersSchemas = {
  getMetadata: {
    query: z.object({
      type: providerType,
      url: z.string().url(),
      apiKey: z.string().optional().default(''),
      /**
       * JSON-encoded extra settings (e.g. { "userId": "abc" } for Jellyfin).
       * Passed as a URL-encoded JSON string so it fits cleanly in a GET query.
       */
      settings: z
        .string()
        .optional()
        .transform((val) => {
          if (!val) return {};
          try {
            return JSON.parse(val) as Record<string, unknown>;
          } catch {
            return {};
          }
        }),
    }),
  },
};

export type GetMetadataQuery = z.infer<typeof providersSchemas.getMetadata.query>;
