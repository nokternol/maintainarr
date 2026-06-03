import { z } from 'zod';

const idParams = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'id must be a positive integer')
    .transform((v) => Number.parseInt(v, 10)),
});

export const savedQuerySchemas = {
  create: {
    body: z.object({
      name: z.string().min(1).max(200),
      filters: z.record(z.string(), z.unknown()),
    }),
  },
  delete: {
    params: idParams,
  },
};

export type CreateSavedQueryBody = z.infer<typeof savedQuerySchemas.create.body>;
export type SavedQueryIdParams = z.infer<typeof idParams>;
