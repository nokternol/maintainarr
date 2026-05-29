import type { Story } from '@ladle/react';
import { useState } from 'react';
import { Tabs } from './index';
import type { Tab } from './index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Controlled<T extends string>({ initial, tabs }: { initial: T; tabs: Tab<T>[] }) {
  const [active, setActive] = useState<T>(initial);
  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={active} onChange={setActive} />
      <p className="text-xs text-text-muted font-mono">active: {active}</p>
    </div>
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Default: Story = () => (
  <div className="bg-surface-bg p-8">
    <Controlled
      initial="movies"
      tabs={[
        { value: 'movies', label: 'Movies' },
        { value: 'series', label: 'Series' },
      ]}
    />
  </div>
);

export const WithCounts: Story = () => (
  <div className="bg-surface-bg p-8">
    <Controlled
      initial="movies"
      tabs={[
        { value: 'movies', label: 'Movies', count: 1482 },
        { value: 'series', label: 'Series', count: 243 },
      ]}
    />
  </div>
);

export const LoadingCounts: Story = () => (
  <div className="bg-surface-bg p-8">
    <Controlled
      initial="movies"
      tabs={[
        { value: 'movies', label: 'Movies', count: 1482, loading: true },
        { value: 'series', label: 'Series', count: 243, loading: true },
      ]}
    />
  </div>
);

export const ThreeTabs: Story = () => (
  <div className="bg-surface-bg p-8">
    <Controlled
      initial="all"
      tabs={[
        { value: 'all', label: 'All', count: 1725 },
        { value: 'movies', label: 'Movies', count: 1482 },
        { value: 'series', label: 'Series', count: 243 },
      ]}
    />
  </div>
);

export const OnSurface: Story = () => (
  <div className="bg-surface-bg p-8">
    <div className="bg-surface-panel rounded-md p-4 border border-border">
      <Controlled
        initial="movies"
        tabs={[
          { value: 'movies', label: 'Movies', count: 1482 },
          { value: 'series', label: 'Series', count: 243 },
        ]}
      />
    </div>
  </div>
);
