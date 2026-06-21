import { SavedQuerySchema } from '@app/lib/api/schemas';
import { isAuthenticated } from '@server/middleware/auth';
import type { MediaSourceFactory } from '@server/providers/mediaSourceFactory';
import type { MediaQueryEngine } from '@server/services/mediaQueryEngine';
import type { SavedMediaQueryService } from '@server/services/savedMediaQueryService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';
import { mediaQuerySchemas } from './mediaQueries.schemas';

interface Cradle {
  savedMediaQueryService: SavedMediaQueryService;
  mediaSourceFactory: MediaSourceFactory;
  mediaQueryEngine: MediaQueryEngine;
}

export function createMediaQueryHandlers(cradle: Cradle) {
  const { savedMediaQueryService, mediaSourceFactory, mediaQueryEngine } = cradle;

  return {
    list: [
      isAuthenticated(),
      defineRoute({
        schemas: { response: z.array(SavedQuerySchema) },
        handler: async () => savedMediaQueryService.list(),
      }),
    ],

    create: [
      isAuthenticated(),
      defineRoute({
        schemas: { ...mediaQuerySchemas.create, response: SavedQuerySchema },
        handler: async ({ body }) =>
          savedMediaQueryService.create({
            name: body.name,
            contentType: body.contentType,
            filterValues: body.filterValues,
          }),
      }),
    ],

    delete: [
      isAuthenticated(),
      defineRoute({
        schemas: mediaQuerySchemas.delete,
        handler: async ({ params }) => {
          await savedMediaQueryService.delete(params.id);
          return null;
        },
      }),
    ],

    preview: [
      isAuthenticated(),
      defineRoute({
        schemas: {
          params: mediaQuerySchemas.delete.params,
          response: z.object({ count: z.number() }),
        },
        handler: async ({ params }) => {
          const query = await savedMediaQueryService.getById(params.id);
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
