import { z } from 'zod';

const idParams = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'id must be a positive integer')
    .transform((v) => Number.parseInt(v, 10)),
});

const listRunsQuery = z.object({
  automationId: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number.parseInt(v, 10))
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Math.min(Number.parseInt(v, 10), 100))
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number.parseInt(v, 10))
    .optional(),
});

export const automationSchemas = {
  list: {
    query: z.object({
      kind: z.enum(['user', 'system']).optional(),
    }),
  },

  create: {
    body: z.object({
      name: z.string().min(1).max(200),
      queryId: z.number().int().positive(),
      providerId: z.number().int().positive(),
      taskId: z.string().min(1),
      schedule: z.string().min(1),
    }),
  },

  updateStatus: {
    params: idParams,
    body: z.object({
      status: z.enum(['active', 'paused']),
    }),
  },

  delete: {
    params: idParams,
  },

  listRuns: {
    query: listRunsQuery,
  },
};

export type CreateAutomationBody = z.infer<typeof automationSchemas.create.body>;
export type UpdateAutomationStatusBody = z.infer<typeof automationSchemas.updateStatus.body>;
export type AutomationIdParams = z.infer<typeof idParams>;
export type ListRunsQuery = z.infer<typeof listRunsQuery>;
