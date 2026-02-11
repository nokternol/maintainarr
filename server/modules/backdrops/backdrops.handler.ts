import type { TmdbService } from '@server/services/tmdbService';
import { defineRoute } from '@server/utils/defineRoute';
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
