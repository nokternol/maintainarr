import { MetadataProviderType } from '@server/database/schema';
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
  getRatings: {
    query: z.object({
      title: z.string().min(1),
      year: z
        .string()
        .optional()
        .transform((val) => (val ? Number.parseInt(val, 10) : undefined)),
      tmdbApiKey: z.string().optional(),
      omdbApiKey: z.string().optional(),
    }),
  },
};

export type GetMetadataQuery = z.infer<typeof providersSchemas.getMetadata.query>;
export type GetRatingsQuery = z.infer<typeof providersSchemas.getRatings.query>;
