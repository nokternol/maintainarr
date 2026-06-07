import { z } from 'zod';

const idParams = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'id must be a positive integer')
    .transform((v) => Number.parseInt(v, 10)),
});

const filterValueEntry = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const savedQuerySchemas = {
  create: {
    body: z.object({
      name: z.string().min(1).max(200),
      contentType: z.enum(['movie', 'show']),
      filterValues: z.array(filterValueEntry),
    }),
  },
  delete: {
    params: idParams,
  },
};

export type CreateSavedQueryBody = z.infer<typeof savedQuerySchemas.create.body>;
export type SavedQueryIdParams = z.infer<typeof idParams>;
