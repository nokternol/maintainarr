import type { AwilixContainer } from 'awilix';
import type { Cradle } from '../container';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      scope: AwilixContainer<Cradle>;
    }
  }
}
