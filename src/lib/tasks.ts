import { PROVIDER_REGISTRY } from './provider-registry';
import type { TaskDef } from './provider-registry';

export type { TaskDef } from './provider-registry';

export const PROVIDER_TASKS: Record<string, TaskDef[]> = Object.fromEntries(
  Object.entries(PROVIDER_REGISTRY).map(([type, entry]) => [type, entry.tasks])
);

export function getEnabledTasksForProvider(type: string, enabledIds: string[]): TaskDef[] {
  const all = PROVIDER_TASKS[type] ?? [];
  return all.filter((t) => enabledIds.includes(t.id));
}
