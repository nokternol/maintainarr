import { eq } from 'drizzle-orm';
import { automations } from '../database/schema';
import type { DrizzleDb } from '../kernel/db';

const SYSTEM_JOBS = [
  {
    name: 'system:identity-resolution',
    taskId: 'system:identity-resolution',
    schedule: '0 * * * *',
  },
  { name: 'system:enrichment', taskId: 'system:enrichment', schedule: '0 */6 * * *' },
] as const;

export async function ensureSystemJobs(db: DrizzleDb): Promise<void> {
  const existing = await db
    .select({ name: automations.name })
    .from(automations)
    .where(eq(automations.kind, 'system'));

  const existingNames = new Set(existing.map((r) => r.name));

  for (const job of SYSTEM_JOBS) {
    if (!existingNames.has(job.name)) {
      await db.insert(automations).values({ ...job, kind: 'system' });
    }
  }
}
