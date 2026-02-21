import AppLayout from '@app/components/AppLayout';
import Badge from '@app/components/Badge';
import Card from '@app/components/Card';
import EmptyState from '@app/components/EmptyState';
import Sidebar from '@app/components/Sidebar';
import StatCard from '@app/components/StatCard';
import TopBar from '@app/components/TopBar';
import WidgetGrid from '@app/components/WidgetGrid';
import type { SidebarItem } from '@app/types/navigation';

// Icons
const DashboardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const TaskIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const FolderIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

const CalendarIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const ActivityIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
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
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
    />
  </svg>
);

const ChartIcon = () => (
  <svg
    className="w-8 h-8"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const InboxIcon = () => (
  <svg
    className="w-16 h-16"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
    />
  </svg>
);

// Navigation items
const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    href: '/dashboard',
    active: true,
  },
  { id: 'tasks', label: 'Tasks', icon: <TaskIcon />, href: '/tasks', badge: 5 },
  { id: 'collections', label: 'Collections', icon: <FolderIcon />, href: '/collections' },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon />, href: '/calendar' },
  { id: 'activity', label: 'Activity', icon: <ActivityIcon />, href: '/activity' },
];

const bottomItems: SidebarItem[] = [
  { id: 'settings', label: 'Settings', icon: <SettingsIcon />, href: '/settings' },
  { id: 'system', label: 'System', icon: <SystemIcon />, href: '/system', badge: 1 },
];

export default function DashboardPage() {
  return (
    <AppLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          bottomItems={bottomItems}
          logo={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-text-primary font-bold">
                M
              </div>
              <span className="text-xl font-bold text-text-primary">Maintainarr</span>
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
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-bg"
            >
              New Task
            </button>
          }
        />
      }
    >
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <WidgetGrid columns={4}>
          <StatCard
            value={142}
            label="Active Tasks"
            icon={<TaskIcon />}
            trend={{ value: 12, direction: 'up' }}
            subtitle="12% increase from last week"
          />
          <StatCard
            value={28}
            label="Collections"
            icon={<FolderIcon />}
            subtitle="3 new this month"
          />
          <StatCard value="Running" label="System Status" subtitle="All services operational" />
          <StatCard
            value={1248}
            label="Total Items"
            icon={<ChartIcon />}
            trend={{ value: 8, direction: 'down' }}
          />
        </WidgetGrid>

        {/* Content Grid */}
        <WidgetGrid columns={2}>
          {/* Recent Tasks Card */}
          <Card
            variant="outlined"
            header={
              <div className="flex items-center justify-between">
                <h3 className="text-text-primary font-semibold">Recent Tasks</h3>
                <Badge variant="teal">Active</Badge>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between pb-3 border-b border-border">
                <div>
                  <p className="text-text-primary font-medium">Update library metadata</p>
                  <p className="text-sm text-text-muted">Started 2 hours ago</p>
                </div>
                <Badge variant="success" size="sm">
                  Running
                </Badge>
              </div>
              <div className="flex items-start justify-between pb-3 border-b border-border">
                <div>
                  <p className="text-text-primary font-medium">Organize collections</p>
                  <p className="text-sm text-text-muted">Completed 1 day ago</p>
                </div>
                <Badge variant="default" size="sm">
                  Completed
                </Badge>
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-text-primary font-medium">Clean up duplicates</p>
                  <p className="text-sm text-text-muted">Scheduled for tomorrow</p>
                </div>
                <Badge variant="warning" size="sm">
                  Pending
                </Badge>
              </div>
            </div>
          </Card>

          {/* Activity Feed Card */}
          <Card
            variant="outlined"
            header={<h3 className="text-text-primary font-semibold">Recent Activity</h3>}
          >
            <EmptyState
              icon={<InboxIcon />}
              title="No recent activity"
              description="Activity from automated tasks and manual actions will appear here"
            />
          </Card>
        </WidgetGrid>

        {/* Quick Actions */}
        <Card
          variant="elevated"
          header={<h3 className="text-text-primary font-semibold">Quick Actions</h3>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              className="p-4 bg-surface-panel hover:bg-surface-bg border border-border rounded-lg transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <TaskIcon />
                <div>
                  <p className="text-text-primary font-medium">Create Task</p>
                  <p className="text-sm text-text-muted">Automate a new workflow</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="p-4 bg-surface-panel hover:bg-surface-bg border border-border rounded-lg transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FolderIcon />
                <div>
                  <p className="text-text-primary font-medium">New Collection</p>
                  <p className="text-sm text-text-muted">Organize your items</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="p-4 bg-surface-panel hover:bg-surface-bg border border-border rounded-lg transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <SettingsIcon />
                <div>
                  <p className="text-text-primary font-medium">Configure</p>
                  <p className="text-sm text-text-muted">Adjust system settings</p>
                </div>
              </div>
            </button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
