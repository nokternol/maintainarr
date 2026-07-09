import { z } from 'zod';

export const healthSchemas = {
  getHealth: {
    response: z.object({
      status: z.string(),
      timestamp: z.string(),
      version: z.string(),
      environment: z.string(),
    }),
  },
};

export type HealthResponse = z.infer<typeof healthSchemas.getHealth.response>;
