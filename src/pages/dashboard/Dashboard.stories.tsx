import AppLayout from '@app/components/AppLayout';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import type { SidebarItem } from '@app/types/navigation';
import type { Story } from '@ladle/react';
import { DashboardContent, type Automation, type RunRecord } from './index';

// ── Shared chrome ──────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const AutomationIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const MediaIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SystemIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const navItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard', active: true },
  { id: 'media', label: 'Media', icon: <MediaIcon />, href: '/media' },
  { id: 'search', label: 'Search', icon: <SearchIcon />, href: '/search' },
  { id: 'automations', label: 'Automations', icon: <AutomationIcon />, href: '/automations', badge: 1 },
  { id: 'activity', label: 'Activity', icon: <ActivityIcon />, href: '/activity' },
];

const bottomNavItems: SidebarItem[] = [
  { id: 'settings', label: 'Settings', icon: <SettingsIcon />, href: '/settings' },
  { id: 'system', label: 'System', icon: <SystemIcon />, href: '/system' },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      sidebar={
        <Sidebar
          items={navItems}
          bottomItems={bottomNavItems}
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
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-sm transition-colors duration-150"
            >
              + New automation
            </button>
          }
        />
      }
    >
      {children}
    </AppLayout>
  );
}

// ── Fixture data ───────────────────────────────────────────────────────────────

const activeAutomations: Automation[] = [
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
    name: 'Tag recent additions',
    queryName: 'Added in last 30 days',
    taskName: 'Add "New" collection tag',
    schedule: 'Daily at midnight',
    status: 'active',
    lastRun: { relativeTime: '14h ago', itemCount: 3, action: 'tagged' },
    nextRun: 'in 10h',
  },
];

const errorAutomation: Automation = {
  id: '4',
  name: 'Purge low-rated series',
  queryName: 'Series, TMDB score < 5.0',
  taskName: 'Delete from library',
  schedule: '1st of month',
  status: 'error',
  lastRun: { relativeTime: '3d ago', itemCount: 0, action: 'failed' },
  errorMessage: 'Plex connection refused',
};

const pausedAutomation: Automation = {
  id: '5',
  name: 'Notify on 4K availability',
  queryName: 'Library items with 4K upgrade',
  taskName: 'Send webhook notification',
  schedule: 'Weekly on Fridays',
  status: 'paused',
  lastRun: { relativeTime: '2w ago', itemCount: 6, action: 'notified' },
  nextRun: undefined,
};

const neverRunAutomation: Automation = {
  id: '6',
  name: 'Clean watched shorts',
  queryName: 'Movies < 45min, watched',
  taskName: 'Delete from library',
  schedule: 'Monthly, 1st',
  status: 'active',
  nextRun: 'in 12d',
};

const recentRuns: RunRecord[] = [
  { id: 'r1', automationName: 'Archive stale movies', action: 'archived', itemCount: 12, relativeTime: '2h ago' },
  { id: 'r2', automationName: 'Refresh missing metadata', action: 'updated', itemCount: 847, relativeTime: '14h ago' },
  { id: 'r3', automationName: 'Tag recent additions', action: 'tagged', itemCount: 3, relativeTime: '14h ago' },
  { id: 'r4', automationName: 'Archive stale movies', action: 'archived', itemCount: 9, relativeTime: '1w ago' },
];

// ── Stories ────────────────────────────────────────────────────────────────────

/** Default state: mix of active, paused, and one errored automation. */
export const Default: Story = () => (
  <Shell>
    <DashboardContent
      automations={[...activeAutomations.slice(0, 2), errorAutomation]}
      runs={recentRuns.slice(0, 3)}
    />
  </Shell>
);

/** All automations healthy, no errors. */
export const AllActive: Story = () => (
  <Shell>
    <DashboardContent
      automations={activeAutomations}
      runs={recentRuns}
    />
  </Shell>
);

/** Multiple errors and a paused automation. */
export const WithErrors: Story = () => (
  <Shell>
    <DashboardContent
      automations={[
        { ...errorAutomation, id: 'e1', name: 'Purge low-rated series', errorMessage: 'Plex connection refused' },
        { ...errorAutomation, id: 'e2', name: 'Sync collection tags', taskName: 'Sync to Plex collections', errorMessage: 'API timeout after 30s' },
        pausedAutomation,
        activeAutomations[0],
      ]}
      runs={recentRuns.slice(0, 2)}
    />
  </Shell>
);

/** An automation that has never been run yet. */
export const WithNeverRun: Story = () => (
  <Shell>
    <DashboardContent
      automations={[activeAutomations[0], neverRunAutomation]}
      runs={recentRuns.slice(0, 1)}
    />
  </Shell>
);

/** Empty state: no automations configured yet. */
export const Empty: Story = () => (
  <Shell>
    <DashboardContent automations={[]} runs={[]} />
  </Shell>
);

/** Automations exist but no runs have happened yet. */
export const AutomationsNoRuns: Story = () => (
  <Shell>
    <DashboardContent
      automations={[neverRunAutomation, { ...neverRunAutomation, id: 'n2', name: 'Refresh all posters', queryName: 'All library items', taskName: 'Fetch poster from TMDB', schedule: 'Weekly on Sundays', nextRun: 'in 3d' }]}
      runs={[]}
    />
  </Shell>
);
