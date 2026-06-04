import type { CreateAutomationInput } from '@app/hooks/useAutomations';
import { useProviderSettings } from '@app/hooks/useProviderSettings';
import type { SavedQuery } from '@app/hooks/useSavedQueries';
import { getEnabledTasksForProvider } from '@app/lib/tasks';
import type { TaskDef } from '@app/lib/tasks';
import { cn } from '@app/lib/utils/cn';
import { summarizeFilters } from '@app/lib/utils/filterSummary';
import { Cron } from 'croner';
import cronstrue from 'cronstrue';
import { BookMarked, Clock, TriangleAlert, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Schedule presets ─────────────────────────────────────────────────────────

const SCHEDULE_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily 2am', value: '0 2 * * *' },
  { label: 'Weekly', value: '0 2 * * 0' },
  { label: 'Monthly', value: '0 2 1 * *' },
];

function safeHumanSchedule(cron: string): string {
  try {
    return cronstrue.toString(cron, { use24HourTimeFormat: true });
  } catch {
    return 'Invalid cron expression';
  }
}

function safeNextRun(cron: string): Date | null {
  try {
    const job = new Cron(cron, { paused: true });
    const next = job.nextRun();
    job.stop();
    return next;
  } catch {
    return null;
  }
}

function relativeTime(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const past = diffMs < 0;

  if (abs < 60_000) return past ? 'just now' : 'in <1m';
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return past ? `${m}m ago` : `in ${m}m`;
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000);
    return past ? `${h}h ago` : `in ${h}h`;
  }
  const d = Math.round(abs / 86_400_000);
  return past ? `${d}d ago` : `in ${d}d`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuilderTask {
  taskId: string;
  taskDef: TaskDef;
  providerId: number;
  providerName: string;
  providerType: string;
}

// ─── AutomationBuilder ────────────────────────────────────────────────────────

export default function AutomationBuilder({
  queries,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  queries: SavedQuery[];
  onSubmit: (input: CreateAutomationInput) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const { providers } = useProviderSettings();

  const availableTasks = useMemo<BuilderTask[]>(() => {
    if (!providers) return [];
    return providers.flatMap((p) => {
      if (!p.isActive) return [];
      const enabledIds = Array.isArray(p.settings?.enabledTasks)
        ? (p.settings!.enabledTasks as string[])
        : [];
      const tasks = getEnabledTasksForProvider(p.type, enabledIds);
      return tasks.map((t) => ({
        taskId: t.id,
        taskDef: t,
        providerId: p.id,
        providerName: p.name,
        providerType: p.type,
      }));
    });
  }, [providers]);

  const tasksByProvider = useMemo(() => {
    const groups = new Map<
      number,
      { providerName: string; providerType: string; tasks: BuilderTask[] }
    >();
    for (const t of availableTasks) {
      if (!groups.has(t.providerId)) {
        groups.set(t.providerId, {
          providerName: t.providerName,
          providerType: t.providerType,
          tasks: [],
        });
      }
      groups.get(t.providerId)!.tasks.push(t);
    }
    return Array.from(groups.entries());
  }, [availableTasks]);

  const [name, setName] = useState('');
  const [selectedQueryId, setSelectedQueryId] = useState<number | null>(
    queries.length === 1 ? queries[0].id : null
  );
  const [selectedTask, setSelectedTask] = useState<BuilderTask | null>(null);
  const [schedulePreset, setSchedulePreset] = useState(SCHEDULE_PRESETS[1].value);
  const [customSchedule, setCustomSchedule] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const effectiveCron = isCustom ? customSchedule : schedulePreset;
  const humanSchedule = effectiveCron ? safeHumanSchedule(effectiveCron) : '';
  const nextRunDate = effectiveCron ? safeNextRun(effectiveCron) : null;
  const isValidCron = nextRunDate !== null;

  const canSubmit =
    name.trim().length > 0 && selectedQueryId !== null && selectedTask !== null && isValidCron;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || !selectedQueryId || !selectedTask) return;
      setSubmitError(null);
      onSubmit({
        name: name.trim(),
        queryId: selectedQueryId,
        providerId: selectedTask.providerId,
        taskId: selectedTask.taskId,
        schedule: effectiveCron,
      });
    },
    [canSubmit, selectedQueryId, selectedTask, name, effectiveCron, onSubmit]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-primary/30 bg-surface-panel"
      noValidate
    >
      {/* Form header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <span className="text-sm font-semibold text-text-primary">New automation</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
        >
          Cancel
        </button>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* ── Name ── */}
        <div>
          <label
            htmlFor="auto-name"
            className="block text-xs font-medium text-text-secondary mb-1.5"
          >
            Name
          </label>
          <input
            ref={nameRef}
            id="auto-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Archive stale movies"
            className="w-full max-w-md px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary placeholder:text-text-muted/60 focus:border-primary focus:outline-none transition-colors"
            required
          />
        </div>

        {/* ── Query ── */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1">Query</p>
          <p className="text-xs text-text-muted mb-3">Which media this automation targets.</p>
          {queries.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded bg-surface-bg/60 border border-border text-xs text-text-muted">
              <BookMarked
                size={13}
                strokeWidth={1.75}
                className="flex-shrink-0"
                aria-hidden="true"
              />
              <span>
                No saved queries yet.{' '}
                <a href="/media" className="text-primary hover:underline">
                  Save one from the media page
                </a>{' '}
                first.
              </span>
            </div>
          ) : (
            <div className="rounded border border-border overflow-hidden divide-y divide-border/60">
              {queries.map((q) => {
                const selected = selectedQueryId === q.id;
                const parts = summarizeFilters(q.filters);
                return (
                  <label
                    key={q.id}
                    className={cn(
                      'flex items-start gap-3 px-3.5 py-2.5 cursor-pointer transition-colors',
                      selected ? 'bg-primary/8' : 'bg-surface-bg/40 hover:bg-surface-bg/60'
                    )}
                  >
                    <input
                      type="radio"
                      name="query"
                      value={q.id}
                      checked={selected}
                      onChange={() => setSelectedQueryId(q.id)}
                      className="mt-0.5 accent-primary flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium leading-tight',
                          selected ? 'text-primary' : 'text-text-primary'
                        )}
                      >
                        {q.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parts.slice(0, 5).map((p) => (
                          <span
                            key={p}
                            className="text-[11px] text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded"
                          >
                            {p}
                          </span>
                        ))}
                        {parts.length > 5 && (
                          <span className="text-[11px] text-text-muted">
                            +{parts.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Task ── */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1">Task</p>
          <p className="text-xs text-text-muted mb-3">What to do with matched items.</p>
          {tasksByProvider.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded bg-surface-bg/60 border border-border text-xs text-text-muted">
              <Zap size={13} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
              <span>
                No enabled tasks found. Enable tasks on your providers in{' '}
                <a href="/settings" className="text-primary hover:underline">
                  Settings
                </a>
                .
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {tasksByProvider.map(([providerId, group]) => (
                <div key={providerId} className="rounded border border-border overflow-hidden">
                  <div className="px-3 py-1.5 bg-surface-bg/60 border-b border-border/60">
                    <span className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
                      {group.providerName}
                      <span className="ml-1.5 normal-case tracking-normal font-normal opacity-60">
                        {group.providerType}
                      </span>
                    </span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {group.tasks.map((bt: BuilderTask) => {
                      const selected =
                        selectedTask?.taskId === bt.taskId &&
                        selectedTask?.providerId === bt.providerId;
                      return (
                        <label
                          key={`${bt.providerId}-${bt.taskId}`}
                          className={cn(
                            'flex items-start gap-3 px-3.5 py-2.5 cursor-pointer transition-colors',
                            selected ? 'bg-primary/8' : 'bg-surface-panel hover:bg-surface-bg/40'
                          )}
                        >
                          <input
                            type="radio"
                            name="task"
                            checked={selected}
                            onChange={() => setSelectedTask(bt)}
                            className="mt-0.5 accent-primary flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  selected ? 'text-primary' : 'text-text-primary'
                                )}
                              >
                                {bt.taskDef.label}
                              </span>
                              {bt.taskDef.destructive && (
                                <TriangleAlert
                                  size={12}
                                  strokeWidth={1.75}
                                  className="text-warning flex-shrink-0"
                                  aria-label="Destructive action"
                                />
                              )}
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">
                              {bt.taskDef.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Schedule ── */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1">Schedule</p>
          <p className="text-xs text-text-muted mb-3">When this automation runs.</p>

          {/* Preset chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {SCHEDULE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setSchedulePreset(p.value);
                  setIsCustom(false);
                }}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel',
                  !isCustom && schedulePreset === p.value
                    ? 'bg-primary text-white'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-bg'
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel',
                isCustom
                  ? 'bg-primary text-white'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-bg'
              )}
            >
              Custom
            </button>
          </div>

          {/* Custom cron input */}
          {isCustom && (
            <div className="mb-2.5">
              <input
                type="text"
                value={customSchedule}
                onChange={(e) => setCustomSchedule(e.target.value)}
                placeholder="e.g. 0 3 * * 1-5"
                className={cn(
                  'w-48 px-3 py-1.5 text-sm font-mono bg-surface-bg border rounded text-text-primary focus:outline-none transition-colors',
                  !isValidCron && customSchedule
                    ? 'border-danger'
                    : 'border-border focus:border-primary'
                )}
              />
            </div>
          )}

          {/* Schedule description */}
          {effectiveCron && (
            <div
              className={cn(
                'flex items-center gap-2 text-xs',
                isValidCron ? 'text-text-secondary' : 'text-danger'
              )}
            >
              <Clock size={12} strokeWidth={1.75} aria-hidden="true" />
              <span>
                {isValidCron
                  ? `${humanSchedule} · next ${relativeTime(nextRunDate!)}`
                  : humanSchedule}
              </span>
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        {submitError && <p className="text-xs text-danger">{submitError}</p>}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-sm bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-sm text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel',
              canSubmit && !isSubmitting
                ? 'bg-primary hover:bg-primary-hover'
                : 'bg-primary/40 cursor-not-allowed'
            )}
          >
            {isSubmitting ? 'Creating…' : 'Create automation'}
          </button>
        </div>
      </div>
    </form>
  );
}
