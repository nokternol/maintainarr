import { SavedQuerySchema } from '@app/lib/api/schemas';
import { isAuthenticated } from '@server/middleware/auth';
import type { IProviderFactory } from '@server/providers/providerFactory';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import type { SavedQueryService } from '@server/services/savedQueryService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';
import { savedQuerySchemas } from './savedQueries.schemas';

interface Cradle {
  savedQueryService: SavedQueryService;
  providerSettingsService: ProviderSettingsService;
  providerFactory: IProviderFactory;
}

export function createSavedQueryHandlers(cradle: Cradle) {
  const { savedQueryService } = cradle;

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
          await savedQueryService.getById(params.id);
          return { count: 0 };
        },
      }),
    ],
  };
}
