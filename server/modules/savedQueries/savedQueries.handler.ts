import { SavedQuerySchema } from '@app/lib/api/schemas';
import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import type { IProviderFactory } from '@server/providers/providerFactory';
import type { RadarrProvider } from '@server/providers/radarrProvider';
import type { SonarrProvider } from '@server/providers/sonarrProvider';
import type { MediaQueryEngine } from '@server/services/mediaQueryEngine';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import type { ContentType, SavedQueryService } from '@server/services/savedQueryService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';
import { savedQuerySchemas } from './savedQueries.schemas';

const log = getChildLogger('SavedQueryHandler');

// The provider type that owns each content type under the single-active invariant.
const OWNER_TYPE: Record<ContentType, MetadataProviderType> = {
  movie: MetadataProviderType.RADARR,
  show: MetadataProviderType.SONARR,
};

interface Cradle {
  savedQueryService: SavedQueryService;
  providerSettingsService: ProviderSettingsService;
  providerFactory: IProviderFactory;
  mediaQueryEngine: MediaQueryEngine;
}

export function createSavedQueryHandlers(cradle: Cradle) {
  const { savedQueryService, providerSettingsService, providerFactory, mediaQueryEngine } = cradle;

  return {
    list: [
      isAuthenticated(),
      defineRoute({
        schemas: { response: z.array(SavedQuerySchema) },
        handler: async () => savedQueryService.list(),
      }),
    ],

    create: [
      isAuthenticated(),
      defineRoute({
        schemas: { ...savedQuerySchemas.create, response: SavedQuerySchema },
        handler: async ({ body }) =>
          savedQueryService.create({
            name: body.name,
            contentType: body.contentType,
            filterValues: body.filterValues,
          }),
      }),
    ],

    delete: [
      isAuthenticated(),
      defineRoute({
        schemas: savedQuerySchemas.delete,
        handler: async ({ params }) => {
          await savedQueryService.delete(params.id);
          return null;
        },
      }),
    ],

    preview: [
      isAuthenticated(),
      defineRoute({
        schemas: {
          params: savedQuerySchemas.delete.params,
          response: z.object({ count: z.number() }),
        },
        handler: async ({ params }) => {
          const query = await savedQueryService.getById(params.id);
          const [settings] = await providerSettingsService.findActiveByTypes([
            OWNER_TYPE[query.contentType],
          ]);
          if (!settings) return { count: 0 };

          const provider = providerFactory.create(settings, log) as RadarrProvider | SonarrProvider;
          const set = await mediaQueryEngine.evaluate({
            provider,
            contentType: query.contentType,
            sources: [{ filterValues: query.filterValues, role: 'include' }],
          });
          return { count: set.length };
        },
      }),
    ],
  };
}
