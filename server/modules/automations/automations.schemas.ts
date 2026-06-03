import { z } from 'zod';

const idParams = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'id must be a positive integer')
    .transform((v) => Number.parseInt(v, 10)),
});

export const automationSchemas = {
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
};

export type CreateAutomationBody = z.infer<typeof automationSchemas.create.body>;
export type UpdateAutomationStatusBody = z.infer<typeof automationSchemas.updateStatus.body>;
export type AutomationIdParams = z.infer<typeof idParams>;
