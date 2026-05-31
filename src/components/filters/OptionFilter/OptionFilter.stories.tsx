import type { Story } from '@ladle/react';
import { useState } from 'react';
import { OptionFilter } from './index';

// ─── Controlled wrapper ───────────────────────────────────────────────────────

function Controlled<T extends string>({
  label,
  options,
  initial,
  variant,
}: {
  label?: string;
  options: Array<{ value: T; label: string }>;
  initial?: T;
  variant?: 'segment' | 'chips';
}) {
  const [value, setValue] = useState<T | undefined>(initial);
  return (
    <div className="space-y-3">
      <OptionFilter
        label={label}
        options={options}
        value={value}
        onChange={setValue}
        variant={variant}
      />
      <p className="text-xs text-text-muted font-mono">
        value: <span className="text-text-secondary">{value ?? 'undefined (All)'}</span>
      </p>
    </div>
  );
}

// ─── Option fixtures ──────────────────────────────────────────────────────────

const FILE_STATUS = [
  { value: 'true' as const, label: 'Downloaded' },
  { value: 'false' as const, label: 'Missing' },
];

const WATCHED = [
  { value: 'true' as const, label: 'Watched' },
  { value: 'false' as const, label: 'Unwatched' },
];

const MONITORED = [
  { value: 'true' as const, label: 'Monitored' },
  { value: 'false' as const, label: 'Unmonitored' },
];

const SERIES_STATUS = [
  { value: 'continuing', label: 'Continuing' },
  { value: 'ended', label: 'Ended' },
];

const SERIES_TYPE = [
  { value: 'standard', label: 'Standard' },
  { value: 'anime', label: 'Anime' },
  { value: 'daily', label: 'Daily' },
];

// ─── Stories ──────────────────────────────────────────────────────────────────

export const SegmentDefault: Story = () => (
  <div className="bg-surface-bg p-8 space-y-6">
    <Controlled label="Movies" options={FILE_STATUS} />
  </div>
);

export const SegmentActive: Story = () => (
  <div className="bg-surface-bg p-8 space-y-6">
    <Controlled label="Movies" options={FILE_STATUS} initial="true" />
  </div>
);

export const SegmentNoLabel: Story = () => (
  <div className="bg-surface-bg p-8 space-y-6">
    <Controlled options={WATCHED} />
  </div>
);

export const SegmentThreeOptions: Story = () => (
  <div className="bg-surface-bg p-8 space-y-6">
    <Controlled label="Type" options={SERIES_TYPE} />
    <Controlled label="Type" options={SERIES_TYPE} initial="anime" />
  </div>
);

export const SegmentGroup: Story = () => (
  <div className="bg-surface-bg p-8">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-surface-bg/40 border border-border rounded-lg px-3 py-1 inline-flex">
      <Controlled label="Series" options={MONITORED} />
      <Controlled label="Status" options={SERIES_STATUS} />
      <Controlled label="Type" options={SERIES_TYPE} />
    </div>
  </div>
);

export const SegmentOnPanel: Story = () => (
  <div className="bg-surface-panel border-b border-border px-6 py-2 space-y-1.5">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-surface-bg/40 border border-border rounded-lg px-3 py-1">
        <Controlled label="Movies" options={FILE_STATUS} />
      </div>
      <div className="h-5 w-px bg-border" aria-hidden="true" />
      <Controlled options={WATCHED} />
    </div>
  </div>
);

export const ChipsDefault: Story = () => (
  <div className="bg-surface-bg p-8 space-y-6">
    <Controlled label="Movies" options={FILE_STATUS} variant="chips" />
  </div>
);

export const ChipsActive: Story = () => (
  <div className="bg-surface-bg p-8 space-y-6">
    <Controlled label="Movies" options={FILE_STATUS} initial="true" variant="chips" />
  </div>
);

export const ChipsThreeOptions: Story = () => (
  <div className="bg-surface-bg p-8 space-y-6">
    <Controlled label="Type" options={SERIES_TYPE} variant="chips" />
    <Controlled label="Type" options={SERIES_TYPE} initial="anime" variant="chips" />
  </div>
);

export const AllVariants: Story = () => (
  <div className="bg-surface-bg p-8 space-y-8">
    <div>
      <p className="text-xs text-text-muted mb-3 font-mono">segment / inactive</p>
      <OptionFilter label="Movies" options={FILE_STATUS} value={undefined} onChange={() => {}} />
    </div>
    <div>
      <p className="text-xs text-text-muted mb-3 font-mono">segment / active</p>
      <OptionFilter label="Movies" options={FILE_STATUS} value="true" onChange={() => {}} />
    </div>
    <div>
      <p className="text-xs text-text-muted mb-3 font-mono">segment / 3 options</p>
      <OptionFilter label="Type" options={SERIES_TYPE} value="anime" onChange={() => {}} />
    </div>
    <div>
      <p className="text-xs text-text-muted mb-3 font-mono">chips / inactive</p>
      <OptionFilter options={WATCHED} value={undefined} onChange={() => {}} variant="chips" />
    </div>
    <div>
      <p className="text-xs text-text-muted mb-3 font-mono">chips / active</p>
      <OptionFilter options={WATCHED} value="false" onChange={() => {}} variant="chips" />
    </div>
  </div>
);
