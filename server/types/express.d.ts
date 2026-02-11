import type { AwilixContainer } from 'awilix';
import type { Cradle } from '../container';
import type { User } from '../database/entities/User';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      scope: AwilixContainer<Cradle>;
      user?: User;
    }
    interface Session {
      userId?: number;
    }
  }
}
