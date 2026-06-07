import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors';

interface RouteContext<TBody, TQuery, TParams> {
  body: TBody;
  query: TQuery;
  params: TParams;
  requestId: string;
  req: Request;
  res: Response;
}

/**
 * Creates a typed, validated Express route handler.
 *
 * The `response` schema constrains the handler's return type to the schema's
 * *input* type (`z.input<>`), not its output. This means handlers can return
 * native values (e.g. `Date`) and the schema's transform/preprocess handles
 * any wire-format conversion — no manual `.toISOString()` required.
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
  TResponseSchema extends z.ZodTypeAny = z.ZodTypeAny,
>(definition: {
  schemas?: {
    body?: z.ZodType<TBody>;
    query?: z.ZodType<TQuery>;
    params?: z.ZodType<TParams>;
    response?: TResponseSchema;
  };
  handler: (ctx: RouteContext<TBody, TQuery, TParams>) => Promise<z.input<TResponseSchema>>;
}): RequestHandler {
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
