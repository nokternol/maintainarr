import AppLayout from '@app/components/AppLayout';
import Card from '@app/components/Card';
import EmptyState from '@app/components/EmptyState';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import { cn } from '@app/lib/utils/cn';
import type { SidebarItem } from '@app/types/navigation';

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

// ── Icons ──────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const AutomationIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const MediaIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
    />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const SystemIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
    />
  </svg>
);

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

// ── Navigation ─────────────────────────────────────────────────────────────────

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    href: '/dashboard',
    active: true,
  },
  { id: 'media', label: 'Media', icon: <MediaIcon />, href: '/media' },
  { id: 'search', label: 'Search', icon: <SearchIcon />, href: '/search' },
  {
    id: 'automations',
    label: 'Automations',
    icon: <AutomationIcon />,
    href: '/automations',
    badge: 1,
  },
  { id: 'activity', label: 'Activity', icon: <ActivityIcon />, href: '/activity' },
];

const bottomItems: SidebarItem[] = [
  { id: 'settings', label: 'Settings', icon: <SettingsIcon />, href: '/settings' },
  { id: 'system', label: 'System', icon: <SystemIcon />, href: '/system' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

const COL_TEMPLATE = '1fr 160px 168px 88px';

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
      className="grid items-start px-4 py-3 border-b border-border last:border-0 transition-colors duration-150 hover:bg-surface-bg cursor-pointer"
      style={{
        gridTemplateColumns: COL_TEMPLATE,
        ...(isError && { backgroundColor: 'rgba(220, 38, 38, 0.04)' }),
      }}
    >
      {/* Name + query + task */}
      <div className="min-w-0 pr-6">
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
      </div>

      {/* Schedule */}
      <div className="text-xs font-mono text-text-secondary leading-5">{automation.schedule}</div>

      {/* Last run */}
      <div>
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

      {/* Next run */}
      <div className="text-right">
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
            <div
              className="grid items-center px-4 py-2 border-b border-border"
              style={{ gridTemplateColumns: COL_TEMPLATE }}
            >
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Automation
              </span>
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Schedule
              </span>
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Last run
              </span>
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide text-right">
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <AppLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          bottomItems={bottomItems}
          onLogout={handleLogout}
          logo={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-sm font-bold">
                W
              </div>
              <span className="text-xl font-bold text-text-primary">Warden</span>
            </div>
          }
        />
      }
      topBar={
        <TopBar
          title="Dashboard"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]}
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
