import AppLayout from '@app/components/AppLayout';
import { AutomationRow } from '@app/components/AutomationRow';
import SidebarNav from '@app/components/SidebarNav';
import TopBar from '@app/components/TopBar';
import { useAutomations } from '@app/hooks/useAutomations';
import type { CreateAutomationInput } from '@app/hooks/useAutomations';
import type { AutomationDto } from '@app/hooks/useAutomations';
import { useProviderSettings } from '@app/hooks/useProviderSettings';
import { buildQueryParams, useSavedQueries } from '@app/hooks/useSavedQueries';
import type { SavedQuery } from '@app/hooks/useSavedQueries';
import { getEnabledTasksForProvider } from '@app/lib/tasks';
import type { TaskDef } from '@app/lib/tasks';
import { cn } from '@app/lib/utils/cn';
import { summarizeFilters } from '@app/lib/utils/filterSummary';
import { requireAuth } from '@app/lib/utils/requireAuth';
import { relativeTime, safeHumanSchedule } from '@app/lib/utils/time';
import { Cron } from 'croner';
import {
  BookMarked,
  Clapperboard,
  Clock,
  TriangleAlert,
  Trash2,
  Zap,
} from 'lucide-react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const authRedirect = await requireAuth(ctx);
  if (authRedirect) return authRedirect;
  return { props: {} };
};

// ─── Schedule presets ─────────────────────────────────────────────────────────

const SCHEDULE_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily 2am', value: '0 2 * * *' },
  { label: 'Weekly', value: '0 2 * * 0' },
  { label: 'Monthly', value: '0 2 1 * *' },
];

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

// ─── QueryRow ─────────────────────────────────────────────────────────────────

function QueryRow({
  query,
  onLoad,
  onDelete,
}: {
  query: SavedQuery;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const parts = summarizeFilters(query.filters);
  const date = new Date(query.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5 group hover:bg-surface-bg/50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary leading-tight truncate">{query.name}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {parts.length > 0 ? (
            parts.slice(0, 6).map((part) => (
              <span
                key={part}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-surface-bg text-text-muted border border-border leading-none"
              >
                {part}
              </span>
            ))
          ) : (
            <span className="text-xs text-text-muted italic">No filters</span>
          )}
          {parts.length > 6 && (
            <span className="text-[11px] text-text-muted">+{parts.length - 6} more</span>
          )}
        </div>
        <p className="text-[11px] text-text-muted mt-1.5">{date}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
        {confirming ? (
          <>
            <span className="text-xs text-danger font-medium">Delete?</span>
            <button
              type="button"
              onClick={onDelete}
              className="px-2.5 py-1 text-xs font-medium rounded-sm bg-danger text-white hover:bg-danger-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-2.5 py-1 text-xs font-medium rounded-sm bg-surface-panel border border-border text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onLoad}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm bg-surface-panel border border-border text-text-secondary hover:text-text-primary hover:bg-surface-bg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Clapperboard size={12} strokeWidth={2} aria-hidden="true" />
              Load
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete query "${query.name}"`}
              className="flex items-center justify-center w-7 h-7 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── AutomationBuilder ────────────────────────────────────────────────────────

interface BuilderTask {
  taskId: string;
  taskDef: TaskDef;
  providerId: number;
  providerName: string;
  providerType: string;
}

function AutomationBuilder({
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

  // Group tasks by provider
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const router = useRouter();
  const { queries, remove: removeQuery } = useSavedQueries();
  const { automations, isCreating, create, setStatus, remove: removeAutomation } = useAutomations();
  const [showBuilder, setShowBuilder] = useState(false);

  const handleLoad = (query: SavedQuery) => {
    const params = buildQueryParams(query.filters);
    void router.push(params ? `/media?${params}` : '/media');
  };

  const handleCreate = async (input: CreateAutomationInput) => {
    await create(input);
    setShowBuilder(false);
  };

  const activeCount = automations.filter((a) => a.status === 'active').length;
  const errorCount = 0; // reserved for future error status

  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={
        <TopBar
          title="Automations"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]}
          actions={
            <button
              type="button"
              disabled={queries.length === 0 || showBuilder}
              title={
                queries.length === 0 ? 'Save a query first to create an automation' : undefined
              }
              onClick={() => setShowBuilder(true)}
              className={cn(
                'px-4 py-2 text-white text-sm font-medium rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
                queries.length === 0 || showBuilder
                  ? 'bg-primary/40 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover'
              )}
            >
              + New automation
            </button>
          }
        />
      }
    >
      <div className="p-6 space-y-8 max-w-4xl">
        {/* ── Builder ─────────────────────────────────────────────────────── */}
        {showBuilder && (
          <AutomationBuilder
            queries={queries}
            onSubmit={(input) => {
              void handleCreate(input);
            }}
            onCancel={() => setShowBuilder(false)}
            isSubmitting={isCreating}
          />
        )}

        {/* ── Automations list ─────────────────────────────────────────────── */}
        <section aria-labelledby="automations-heading">
          <div className="flex items-center gap-3 mb-1">
            <Zap
              size={16}
              strokeWidth={1.75}
              className={automations.length > 0 ? 'text-primary' : 'text-text-muted'}
              aria-hidden="true"
            />
            <h2 id="automations-heading" className="text-sm font-semibold text-text-primary">
              Automations
            </h2>
            {automations.length > 0 && (
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                {activeCount > 0 && <span className="text-primary">{activeCount} active</span>}
                {activeCount > 0 && errorCount > 0 && <span className="opacity-40">·</span>}
                {errorCount > 0 && <span className="text-danger">{errorCount} error</span>}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mb-4 ml-[28px]">
            Each automation pairs a saved query with a task and a cron schedule.
          </p>

          {automations.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-panel overflow-hidden">
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                <Zap size={28} strokeWidth={1.25} className="text-text-muted" aria-hidden="true" />
                <p className="text-sm font-medium text-text-secondary">No automations yet</p>
                <p className="text-xs text-text-muted max-w-xs">
                  {queries.length === 0
                    ? 'Save a query from the media page, then create an automation to run it on a schedule.'
                    : 'Select a saved query above and click "+ New automation" to get started.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface-panel overflow-hidden">
              {/* Column header */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_168px_88px] items-center px-4 py-2 border-b border-border bg-surface-bg/30">
                <span className="text-xs font-medium text-text-muted">Automation</span>
                <span className="text-xs font-medium text-text-muted">Schedule</span>
                <span className="text-xs font-medium text-text-muted">Last run</span>
                <span className="text-xs font-medium text-text-muted">Next run</span>
              </div>
              {automations.map((a) => (
                <AutomationRow
                  key={a.id}
                  automation={a}
                  onToggle={() => {
                    void setStatus(a.id, a.status === 'active' ? 'paused' : 'active');
                  }}
                  onDelete={() => {
                    void removeAutomation(a.id);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Saved Queries ────────────────────────────────────────────────── */}
        <section aria-labelledby="saved-queries-heading">
          <div className="flex items-center gap-3 mb-1">
            <BookMarked
              size={16}
              strokeWidth={1.75}
              className="text-primary flex-shrink-0"
              aria-hidden="true"
            />
            <h2 id="saved-queries-heading" className="text-sm font-semibold text-text-primary">
              Saved Queries
            </h2>
          </div>
          <p className="text-xs text-text-muted mb-4 ml-[28px]">
            Named filter sets from the Media page. Each automation targets one saved query.
          </p>

          {queries.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-panel overflow-hidden">
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                <BookMarked
                  size={28}
                  strokeWidth={1.25}
                  className="text-text-muted"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-text-secondary">No saved queries yet</p>
                <p className="text-xs text-text-muted max-w-xs">
                  Go to the Media page, apply any combination of filters, and use the "Save as
                  query" button to save them here.
                </p>
                <a
                  href="/media"
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm bg-primary text-white hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg"
                >
                  <Clapperboard size={12} strokeWidth={2} aria-hidden="true" />
                  Go to Media
                </a>
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg border border-border bg-surface-panel overflow-hidden divide-y divide-divider"
              role="list"
              aria-label="Saved queries"
            >
              {queries.map((query) => (
                <div key={query.id} role="listitem">
                  <QueryRow
                    query={query}
                    onLoad={() => handleLoad(query)}
                    onDelete={() => {
                      void removeQuery(query.id);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
