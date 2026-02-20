import type { Story } from '@ladle/react';
import TopBar from './index';

const DemoButton = ({ children }: { children: React.ReactNode }) => (
  <button className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
    {children}
  </button>
);

export const BasicTitle: Story = () => (
  <div className="bg-slate-950 min-h-screen">
    <TopBar title="Dashboard" />
  </div>
);

export const WithActions: Story = () => (
  <div className="bg-slate-950 min-h-screen">
    <TopBar
      title="Tasks"
      actions={
        <>
          <DemoButton>New Task</DemoButton>
          <DemoButton>Refresh</DemoButton>
        </>
      }
    />
  </div>
);

export const WithBreadcrumbs: Story = () => (
  <div className="bg-slate-950 min-h-screen">
    <TopBar
      title="Task Details"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Tasks', href: '/tasks' },
        { label: 'Task #142' },
      ]}
    />
  </div>
);

export const WithEverything: Story = () => (
  <div className="bg-slate-950 min-h-screen">
    <TopBar
      title="Collection Settings"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Collections', href: '/collections' },
        { label: 'Settings' },
      ]}
      actions={
        <>
          <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
            Cancel
          </button>
          <DemoButton>Save Changes</DemoButton>
        </>
      }
    />
  </div>
);

export const Sticky: Story = () => (
  <div className="bg-slate-950 h-screen overflow-y-auto">
    <TopBar title="Scrollable Page" sticky={true} />
    <div className="p-6 space-y-4">
      {Array.from({ length: 50 }, (_, i) => (
        <div key={i} className="bg-slate-900 p-4 rounded-lg border border-slate-700 text-white">
          Content block {i + 1}
        </div>
      ))}
    </div>
  </div>
);

export const NoTitle: Story = () => (
  <div className="bg-slate-950 min-h-screen">
    <TopBar
      actions={
        <>
          <DemoButton>Action 1</DemoButton>
          <DemoButton>Action 2</DemoButton>
        </>
      }
    />
  </div>
);

export const LongBreadcrumbs: Story = () => (
  <div className="bg-slate-950 min-h-screen">
    <TopBar
      title="Deeply Nested Page"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Collections', href: '/collections' },
        { label: 'My Collection', href: '/collections/1' },
        { label: 'Items', href: '/collections/1/items' },
        { label: 'Item Details' },
      ]}
    />
  </div>
);
