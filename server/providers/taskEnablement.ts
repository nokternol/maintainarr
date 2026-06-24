/**
 * The per-instance enablement set: which actuator tasks a specific configured
 * provider instance permits, held in its `settings.enabledTasks`. Default off —
 * absent or malformed settings yield no enabled tasks. This is the single
 * authority both `automationService.create` and the executor consult, so a
 * disabled task is neither creatable nor runnable.
 */
export function readEnabledTaskIds(settings: Record<string, unknown> | null | undefined): string[] {
  const raw = settings?.enabledTasks;
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}
