import { defineRoute } from '@server/kernel/defineRoute';
import type { TmdbService } from '@server/services/tmdbService';
import { backdropsSchemas } from './backdrops.schemas';

export function createBackdropsHandlers({ tmdbService }: { tmdbService: TmdbService }) {
  return {
    getBackdrops: defineRoute({
      schemas: backdropsSchemas.getBackdrops,
      handler: async () => {
        const backdrops = await tmdbService.getTrendingBackdrops();
        return backdrops.map((path) => tmdbService.getImageUrl(path, 'original'));
      },
    }),
  };
}
