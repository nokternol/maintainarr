import type { DrizzleDb } from '../database';
import { ensureSystemJobs } from './ensureSystemJobs';

export async function systemHealthCheck(db: DrizzleDb): Promise<void> {
  await ensureSystemJobs(db);
}
