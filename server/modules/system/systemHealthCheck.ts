import type { DrizzleDb } from '../../kernel/db';
import { ensureSystemJobs } from './ensureSystemJobs';

export async function systemHealthCheck(db: DrizzleDb): Promise<void> {
  await ensureSystemJobs(db);
}
