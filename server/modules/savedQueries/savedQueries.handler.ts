import { isAuthenticated } from '@server/middleware/auth';
import type { SavedQueryService } from '@server/services/savedQueryService';
import { defineRoute } from '@server/utils/defineRoute';
import { savedQuerySchemas } from './savedQueries.schemas';

interface Cradle {
  savedQueryService: SavedQueryService;
}

export function createSavedQueryHandlers(cradle: Cradle) {
  const { savedQueryService } = cradle;

  return {
    list: [
      isAuthenticated(),
      defineRoute({
        handler: async () => savedQueryService.list(),
      }),
    ],

    create: [
      isAuthenticated(),
      defineRoute({
        schemas: savedQuerySchemas.create,
        handler: async ({ body }) =>
          savedQueryService.create({
            name: body.name,
            filters: body.filters as Record<string, string | number | boolean | undefined>,
            mediaType: body.mediaType,
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
  };
}
