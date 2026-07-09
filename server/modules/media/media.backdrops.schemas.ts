import { z } from 'zod';

export const backdropsSchemas = {
  getBackdrops: {
    response: z.array(z.string()),
  },
};

export type BackdropsResponse = z.infer<typeof backdropsSchemas.getBackdrops.response>;
