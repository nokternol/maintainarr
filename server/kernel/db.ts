/**
 * Kernel surface for the database handle. `server/database/` remains the
 * schema + migrations home; everything that consumes the handle the container
 * injects (the `DrizzleDb` type and its lifecycle accessors) takes it from
 * here, so the kernel is the only infrastructure import path.
 */
export {
  _resetDatabase,
  closeDatabase,
  getDb,
  initializeDatabase,
} from '../database';
export type { DrizzleDb } from '../database';
