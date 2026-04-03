import { MetadataProviderType } from '@server/database/schema';
import { z } from 'zod';

const providerType = z.nativeEnum(MetadataProviderType);

const idParams = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'id must be a positive integer')
    .transform((v) => Number.parseInt(v, 10)),
});

export const settingsSchemas = {
  listProviders: {},

  createProvider: {
    body: z.object({
      type: providerType,
      name: z.string().min(1),
      url: z.string().url(),
      apiKey: z.string().optional(),
      settings: z.record(z.unknown()).optional(),
      isActive: z.boolean().optional(),
    }),
  },

  updateProvider: {
    params: idParams,
    body: z
      .object({
        name: z.string().min(1).optional(),
        url: z.string().url().optional(),
        apiKey: z.string().optional(),
        settings: z.record(z.unknown()).optional(),
        isActive: z.boolean().optional(),
      })
      .refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' }),
  },

  deleteProvider: {
    params: idParams,
  },
};

export type CreateProviderBody = z.infer<typeof settingsSchemas.createProvider.body>;
export type UpdateProviderBody = z.infer<typeof settingsSchemas.updateProvider.body>;
export type ProviderIdParams = z.infer<typeof idParams>;
