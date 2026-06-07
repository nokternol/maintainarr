import { SavedQuerySchema } from '@app/lib/api/schemas';
import { isAuthenticated } from '@server/middleware/auth';
import type { SavedQueryService } from '@server/services/savedQueryService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';
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
  };
}
