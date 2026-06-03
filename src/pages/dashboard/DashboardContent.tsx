import Card from '@app/components/Card';
import EmptyState from '@app/components/EmptyState';
import type { AutomationDto } from '@app/hooks/useAutomations';
import { cn } from '@app/lib/utils/cn';
import cronstrue from 'cronstrue';
import { Zap } from 'lucide-react';
import { useRouter } from 'next/router';

function safeHumanSchedule(cron: string): string {
  try {
    return cronstrue.toString(cron, { use24HourTimeFormat: true });
  } catch {
    return cron;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function relativeTime(isoOrDate: string | Date): string {
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

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'active' | 'paused' }) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full flex-shrink-0 mt-[3px]',
        status === 'active' ? 'bg-primary' : 'bg-warning'
      )}
      aria-hidden="true"
    />
  );
}

function AutomationRow({ automation }: { automation: AutomationDto }) {
  const nextRunLabel = automation.nextRun ? relativeTime(automation.nextRun) : null;
  const lastRunLabel = automation.lastRun ? relativeTime(automation.lastRun.at) : null;

  return (
    <div className="block sm:grid sm:grid-cols-[1fr_160px_168px] lg:grid-cols-[1fr_160px_168px_88px] sm:items-start px-4 py-3 border-b border-border last:border-0 hover:bg-surface-bg/40 cursor-pointer transition-colors duration-150">
      <div className="min-w-0 sm:pr-6">
        <div className="flex items-start gap-2">
          <StatusDot status={automation.status} />
          <span className="text-sm font-medium text-text-primary leading-5">{automation.name}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 pl-[18px] text-xs text-text-muted min-w-0">
          <span className="truncate">{automation.query.name}</span>
          <span className="opacity-40 flex-shrink-0">·</span>
          <span className="truncate">{automation.taskId}</span>
        </div>
        <div className="sm:hidden mt-1.5 pl-[18px] flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-text-muted">
          <span>{safeHumanSchedule(automation.schedule)}</span>
          {lastRunLabel && (
            <>
              <span className="opacity-40">·</span>
              <span>
                {lastRunLabel}
                {automation.lastRun &&
                  automation.lastRun.itemCount > 0 &&
                  ` · ${automation.lastRun.itemCount} items`}
              </span>
            </>
          )}
          {automation.nextRun && (
            <>
              <span className="opacity-40">·</span>
              <span>next {nextRunLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="hidden sm:block text-xs text-text-secondary leading-5">
        {safeHumanSchedule(automation.schedule)}
      </div>

      <div className="hidden sm:block">
        {automation.lastRun ? (
          <>
            <p className="text-sm text-text-secondary leading-5">{lastRunLabel}</p>
            {automation.lastRun.itemCount > 0 && (
              <p className="text-xs text-text-muted mt-0.5">{automation.lastRun.itemCount} items</p>
            )}
          </>
        ) : (
          <span className="text-xs text-text-muted">Never run</span>
        )}
      </div>

      <div className="hidden lg:block text-right">
        {automation.status === 'paused' ? (
          <span className="text-xs text-warning">Paused</span>
        ) : nextRunLabel ? (
          <span className="text-sm text-text-muted">{nextRunLabel}</span>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </div>
    </div>
  );
}

const EmptyAutomationIcon = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

// ─── DashboardContent ──────────────────────────────────────────────────────────

export function DashboardContent({ automations }: { automations: AutomationDto[] }) {
  const router = useRouter();
  const activeCount = automations.filter((a) => a.status === 'active').length;
  const pausedCount = automations.filter((a) => a.status === 'paused').length;

  const recentRuns = automations
    .filter((a) => a.lastRun)
    .sort((a, b) => new Date(b.lastRun!.at).getTime() - new Date(a.lastRun!.at).getTime())
    .slice(0, 10);

  return (
    <div className="p-6 space-y-4">
      <Card variant="outlined" padding="none">
        <Card.Header>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Automations</h2>
            {automations.length > 0 && (
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                {activeCount > 0 && <span className="text-primary">{activeCount} active</span>}
                {activeCount > 0 && pausedCount > 0 && <span className="opacity-40">·</span>}
                {pausedCount > 0 && <span className="text-warning">{pausedCount} paused</span>}
              </span>
            )}
          </div>
        </Card.Header>

        {automations.length === 0 ? (
          <Card.Content divided>
            <EmptyState
              icon={<EmptyAutomationIcon />}
              title="No automations yet"
              description="An automation pairs a saved query with a task on a schedule. Save a query from the media page, then create an automation."
              action={{
                label: '+ New automation',
                onClick: () => void router.push('/automations'),
              }}
            />
          </Card.Content>
        ) : (
          <>
            <div className="hidden sm:grid sm:grid-cols-[1fr_160px_168px] lg:grid-cols-[1fr_160px_168px_88px] items-center px-4 py-2 border-b border-border bg-surface-bg/30">
              <span className="text-xs font-medium text-text-muted">Automation</span>
              <span className="text-xs font-medium text-text-muted">Schedule</span>
              <span className="text-xs font-medium text-text-muted">Last run</span>
              <span className="hidden lg:block text-xs font-medium text-text-muted text-right">
                Next run
              </span>
            </div>
            {automations.map((a) => (
              <AutomationRow key={a.id} automation={a} />
            ))}
          </>
        )}
      </Card>

      <Card variant="outlined" padding="none">
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">Recent runs</h2>
        </Card.Header>
        <Card.Content divided>
          {recentRuns.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2 text-center">
              <Zap size={28} strokeWidth={1.25} className="text-text-muted" aria-hidden="true" />
              <p className="text-sm font-medium text-text-secondary">No runs yet</p>
              <p className="text-xs text-text-muted max-w-xs">
                Run history will appear here once your automations have executed.
              </p>
            </div>
          ) : (
            recentRuns.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 py-2.5 border-b border-border last:border-0 text-sm min-w-0"
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    a.lastRun!.status === 'error' ? 'bg-danger' : 'bg-primary'
                  )}
                  aria-hidden="true"
                />
                <span className="font-medium text-text-secondary truncate">{a.name}</span>
                <span className="text-text-muted/50 flex-shrink-0">·</span>
                <span className="text-text-muted flex-shrink-0">{a.lastRun!.itemCount} items</span>
                <span className="ml-auto flex-shrink-0 text-xs text-text-muted">
                  {relativeTime(a.lastRun!.at)}
                </span>
              </div>
            ))
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
