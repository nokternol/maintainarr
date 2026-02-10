import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors';

/**
 * Schema definition for a route's input and output.
 * All schemas are optional — omit what you don't need.
 */
interface RouteSchemas<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown> {
  body?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  params?: z.ZodType<TParams>;
  response?: z.ZodType<TResponse>;
}

/**
 * The validated and typed request context passed to the handler.
 */
interface RouteContext<TBody, TQuery, TParams> {
  body: TBody;
  query: TQuery;
  params: TParams;
  requestId: string;
  req: Request;
  res: Response;
}

/**
 * Options for defineRoute.
 */
interface RouteDefinition<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
  TResponse = unknown,
> {
  schemas?: RouteSchemas<TBody, TQuery, TParams, TResponse>;
  handler: (ctx: RouteContext<TBody, TQuery, TParams>) => Promise<TResponse>;
}

/**
 * Creates a typed, validated Express route handler.
 *
 * - Validates request body/query/params against Zod schemas
 * - Throws ValidationError on invalid input (caught by errorHandlerMiddleware)
 * - Catches async errors and forwards them to Express error handling
 * - Returns the handler result wrapped in the ApiSuccessResponse envelope
 *
 * Usage:
 *   router.get('/health', defineRoute({
 *     schemas: { response: z.object({ status: z.string() }) },
 *     handler: async () => ({ status: 'ok' }),
 *   }));
 */
export function defineRoute<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
  TResponse = unknown,
>(definition: RouteDefinition<TBody, TQuery, TParams, TResponse>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(async () => {
        const { schemas, handler } = definition;

        // Validate input schemas
        const body = validateSchema('body', schemas?.body, req.body);
        const query = validateSchema('query', schemas?.query, req.query);
        const params = validateSchema('params', schemas?.params, req.params);

        // Call handler with typed context
        const result = await handler({
          body: body as TBody,
          query: query as TQuery,
          params: params as TParams,
          requestId: req.requestId,
          req,
          res,
        });

        // Send standardized success response
        res.json({ status: 'ok', data: result });
      })
      .catch(next);
  };
}

/**
 * Validates a value against a Zod schema.
 * Throws a ValidationError with field-level errors on failure.
 */
function validateSchema<T>(source: string, schema: z.ZodType<T> | undefined, value: unknown): T {
  if (!schema) return value as T;

  const result = schema.safeParse(value);
  if (!result.success) {
    const fieldErrors = z.flattenError(result.error).fieldErrors as Record<string, string[]>;
    throw new ValidationError(`Invalid ${source}`, fieldErrors);
  }
  return result.data;
}
