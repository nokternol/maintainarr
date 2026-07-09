import { z } from 'zod';

export const searchMetadataQuery = z.object({
  title: z.string().min(1),
});

export type SearchMetadataQuery = z.infer<typeof searchMetadataQuery>;
