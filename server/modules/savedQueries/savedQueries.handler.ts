import { SavedQuerySchema } from '@app/lib/api/schemas';
import { isAuthenticated } from '@server/middleware/auth';
import type { MediaSourceFactory } from '@server/providers/mediaSourceFactory';
import type { MediaQueryEngine } from '@server/services/mediaQueryEngine';
import type { SavedQueryService } from '@server/services/savedQueryService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';
import { savedQuerySchemas } from './savedQueries.schemas';

interface Cradle {
  savedQueryService: SavedQueryService;
  mediaSourceFactory: MediaSourceFactory;
  mediaQueryEngine: MediaQueryEngine;
}

export function createSavedQueryHandlers(cradle: Cradle) {
  const { savedQueryService, mediaSourceFactory, mediaQueryEngine } = cradle;

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
          const source = await mediaSourceFactory.forContentType(query.contentType);
          if (!source) return { count: 0 };

          const set = await mediaQueryEngine.evaluate({
            source,
            contentType: query.contentType,
            sources: [{ filterValues: query.filterValues, role: 'include' }],
          });
          return { count: set.length };
        },
      }),
    ],
  };
}
