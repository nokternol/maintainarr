import type { AwilixContainer } from 'awilix';
import type { SessionData as ExpressSessionData } from 'express-session';
import type { Cradle } from '../container';
import type { PublicUser } from '../database/schema';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      scope: AwilixContainer<Cradle>;
      user?: PublicUser;
    }
    interface Session {}
    interface SessionData extends ExpressSessionData {
      userId?: number;
    }
  }
}
