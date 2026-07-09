import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function failedStateMiddleware(reason: string): RequestHandler {
  return (_req: Request, res: Response, _next: NextFunction) => {
    res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Service Unavailable</title></head>
<body>
  <h1>Service Unavailable</h1>
  <p>${reason}</p>
  <p>The server failed to start. Check the logs and fix the issue, then restart the container.</p>
</body>
</html>`);
  };
}
