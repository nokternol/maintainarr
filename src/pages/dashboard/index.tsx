import AppLayout from '@app/components/AppLayout';
import Card from '@app/components/Card';
import EmptyState from '@app/components/EmptyState';
import SidebarNav from '@app/components/SidebarNav';
import TopBar from '@app/components/TopBar';
import { cn } from '@app/lib/utils/cn';
import { requireAuth } from '@app/lib/utils/requireAuth';
import type { GetServerSideProps } from 'next';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AutomationStatus = 'active' | 'paused' | 'error';

export interface Automation {
  id: string;
  name: string;
  queryName: string;
  taskName: string;
  schedule: string;
  status: AutomationStatus;
  lastRun?: { relativeTime: string; itemCount: number; action: string };
  nextRun?: string;
  errorMessage?: string;
}

export interface RunRecord {
  id: string;
  automationName: string;
  action: string;
  itemCount: number;
  relativeTime: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const AUTOMATIONS: Automation[] = [
  {
    id: '1',
    name: 'Archive stale movies',
    queryName: 'Movies > 2yr, unwatched',
    taskName: 'Move to archive library',
    schedule: 'Sundays at 2:00am',
    status: 'active',
    lastRun: { relativeTime: '2h ago', itemCount: 12, action: 'archived' },
    nextRun: 'in 5d',
  },
  {
    id: '2',
    name: 'Refresh missing metadata',
    queryName: 'All movies, rating absent',
    taskName: 'Update from TMDB',
    schedule: 'Daily at 4:00am',
    status: 'active',
    lastRun: { relativeTime: '22h ago', itemCount: 847, action: 'updated' },
    nextRun: 'in 2h',
  },
  {
    id: '3',
    name: 'Purge low-rated series',
    queryName: 'Series, TMDB score < 5.0',
    taskName: 'Delete from library',
    schedule: '1st of month',
    status: 'error',
    lastRun: { relativeTime: '3d ago', itemCount: 0, action: 'failed' },
    errorMessage: 'Plex connection refused',
  },
];

const RECENT_RUNS: RunRecord[] = [
  {
    id: 'r1',
    automationName: 'Archive stale movies',
    action: 'archived',
    itemCount: 12,
    relativeTime: '2h ago',
  },
  {
    id: 'r2',
    automationName: 'Refresh missing metadata',
    action: 'updated',
    itemCount: 847,
    relativeTime: '22h ago',
  },
  {
    id: 'r3',
    automationName: 'Archive stale movies',
    action: 'archived',
    itemCount: 9,
    relativeTime: '1w ago',
  },
];

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
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const EmptyRunsIcon = () => (
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
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
    />
  </svg>
);

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AutomationStatus }) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full flex-shrink-0 mt-[3px]',
        status === 'active' && 'bg-primary',
        status === 'paused' && 'bg-warning',
        status === 'error' && 'bg-danger'
      )}
      aria-hidden="true"
    />
  );
}

function AutomationRow({ automation }: { automation: Automation }) {
  const isError = automation.status === 'error';

  return (
    <div
      className="block sm:grid sm:grid-cols-[1fr_160px_168px] lg:grid-cols-[1fr_160px_168px_88px] sm:items-start px-4 py-3 border-b border-border last:border-0 transition-colors duration-150 hover:bg-surface-bg cursor-pointer"
      style={isError ? { backgroundColor: 'rgba(220, 38, 38, 0.04)' } : undefined}
    >
      {/* Name + query + task */}
      <div className="min-w-0 sm:pr-6">
        <div className="flex items-start gap-2">
          <StatusDot status={automation.status} />
          <span className="text-sm font-medium text-text-primary leading-5">{automation.name}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 pl-[18px] text-xs text-text-muted min-w-0">
          <span className="truncate">{automation.queryName}</span>
          <span className="opacity-40 flex-shrink-0">·</span>
          <span className="truncate">{automation.taskName}</span>
        </div>
        {isError && automation.errorMessage && (
          <p className="mt-1 pl-[18px] text-xs text-danger">{automation.errorMessage}</p>
        )}
        {/* Mobile-only condensed meta: schedule + last run + next run */}
        <div className="sm:hidden mt-1.5 pl-[18px] flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-text-muted">
          <span className="font-mono">{automation.schedule}</span>
          {automation.lastRun && (
            <>
              <span className="opacity-40">·</span>
              <span>
                {automation.lastRun.relativeTime}
                {automation.lastRun.itemCount > 0 &&
                  ` · ${automation.lastRun.itemCount} ${automation.lastRun.action}`}
              </span>
            </>
          )}
          {automation.status === 'error' ? (
            <>
              <span className="opacity-40">·</span>
              <span className="text-danger">Suspended</span>
            </>
          ) : (
            automation.nextRun && (
              <>
                <span className="opacity-40">·</span>
                <span>next {automation.nextRun}</span>
              </>
            )
          )}
        </div>
      </div>

      {/* Schedule — sm+ only */}
      <div className="hidden sm:block text-xs font-mono text-text-secondary leading-5">
        {automation.schedule}
      </div>

      {/* Last run — sm+ only */}
      <div className="hidden sm:block">
        {automation.lastRun ? (
          <>
            <p className="text-sm text-text-secondary leading-5">
              {automation.lastRun.relativeTime}
            </p>
            {automation.lastRun.itemCount > 0 && (
              <p className="text-xs text-text-muted mt-0.5">
                {automation.lastRun.itemCount} items {automation.lastRun.action}
              </p>
            )}
          </>
        ) : (
          <span className="text-xs text-text-muted">Never run</span>
        )}
      </div>

      {/* Next run — lg+ only */}
      <div className="hidden lg:block text-right">
        {automation.status === 'error' ? (
          <span className="text-xs text-danger">Suspended</span>
        ) : automation.nextRun ? (
          <span className="text-sm text-text-muted">{automation.nextRun}</span>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </div>
    </div>
  );
}

function RunItem({ run }: { run: RunRecord }) {
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-border last:border-0 text-sm min-w-0">
      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
      <span className="font-medium text-text-secondary truncate">{run.automationName}</span>
      <span className="text-text-muted/50 flex-shrink-0">·</span>
      <span className="text-text-muted flex-shrink-0">
        {run.itemCount} items {run.action}
      </span>
      <span className="ml-auto flex-shrink-0 text-xs text-text-muted">{run.relativeTime}</span>
    </div>
  );
}

// ── Content (exported for stories) ────────────────────────────────────────────

interface DashboardContentProps {
  automations: Automation[];
  runs: RunRecord[];
}

export function DashboardContent({ automations, runs }: DashboardContentProps) {
  const activeCount = automations.filter((a) => a.status === 'active').length;
  const errorCount = automations.filter((a) => a.status === 'error').length;

  return (
    <div className="p-6 space-y-4">
      {/* Automations */}
      <Card variant="outlined" padding="none">
        <Card.Header>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Automations</h2>
            {automations.length > 0 && (
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                {activeCount > 0 && <span className="text-primary">{activeCount} active</span>}
                {activeCount > 0 && errorCount > 0 && <span className="opacity-40">·</span>}
                {errorCount > 0 && <span className="text-danger">{errorCount} error</span>}
              </span>
            )}
          </div>
        </Card.Header>

        {automations.length === 0 ? (
          <Card.Content divided>
            <EmptyState
              icon={<EmptyAutomationIcon />}
              title="No automations yet"
              description="An automation pairs a saved query with a task on a schedule. Save a query from the media page, then create an automation to run it automatically."
              action={{ label: '+ New automation', onClick: () => {} }}
            />
          </Card.Content>
        ) : (
          <>
            <div className="hidden sm:grid sm:grid-cols-[1fr_160px_168px] lg:grid-cols-[1fr_160px_168px_88px] items-center px-4 py-2 border-b border-border">
              <span className="text-xs font-medium text-text-muted">Automation</span>
              <span className="text-xs font-medium text-text-muted">Schedule</span>
              <span className="text-xs font-medium text-text-muted">Last run</span>
              <span className="hidden lg:block text-xs font-medium text-text-muted text-right">
                Next run
              </span>
            </div>
            {automations.map((automation) => (
              <AutomationRow key={automation.id} automation={automation} />
            ))}
          </>
        )}
      </Card>

      {/* Recent runs */}
      <Card variant="outlined" padding="none">
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">Recent runs</h2>
        </Card.Header>
        <Card.Content divided>
          {runs.length === 0 ? (
            <EmptyState
              icon={<EmptyRunsIcon />}
              title="No runs yet"
              description="Run history will appear here once your automations have executed."
            />
          ) : (
            runs.map((run) => <RunItem key={run.id} run={run} />)
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

// ── Auth guard ─────────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const authRedirect = await requireAuth(ctx);
  if (authRedirect) return authRedirect;
  return { props: {} };
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={
        <TopBar
          title="Dashboard"
          breadcrumbs={[{ label: 'Dashboard' }]}
          actions={
            <button
              type="button"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg"
            >
              + New automation
            </button>
          }
        />
      }
    >
      <DashboardContent automations={AUTOMATIONS} runs={RECENT_RUNS} />
    </AppLayout>
  );
}
