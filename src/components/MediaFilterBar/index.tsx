import type { FilterState } from '@app/hooks/useMediaFilters';
import type { MediaQualityProfile, MediaTag } from '@app/hooks/useMediaLookups';
import { cn } from '@app/lib/utils/cn';
import { useId } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearRange {
  min: number | null;
  max: number | null;
}

interface Lookups {
  tags: { radarr: MediaTag[]; sonarr: MediaTag[] };
  qualityProfiles: { radarr: MediaQualityProfile[]; sonarr: MediaQualityProfile[] };
}

interface MediaFilterBarProps {
  filterState: FilterState;
  setTitle: (v: string) => void;
  setHasFile: (v: 'true' | 'false' | undefined) => void;
  setMonitored: (v: 'true' | 'false' | undefined) => void;
  setSeriesStatus: (v: string | undefined) => void;
  setYearMin: (v: number | undefined) => void;
  setYearMax: (v: number | undefined) => void;
  setMovieTagIds: (v: string | undefined) => void;
  setSeriesTagIds: (v: string | undefined) => void;
  setMovieQualityProfileIds: (v: string | undefined) => void;
  setSeriesQualityProfileIds: (v: string | undefined) => void;
  clearAll: () => void;
  isActive: boolean;
  movieYearRange: YearRange | null;
  seriesYearRange: YearRange | null;
  lookups: Lookups;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ChipGroup<T extends string | undefined>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-text-muted whitespace-nowrap">{label}:</span>
      {options.map((opt) => (
        <button
          key={String(opt.value ?? 'all')}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-primary text-text-primary'
              : 'bg-surface-panel text-text-secondary hover:bg-surface-hover border border-border'
          )}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  options: Array<{ id: number; displayName: string }>;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const id = useId();

  if (options.length === 0) return null;

  const toggle = (optId: number) => {
    const next = selectedIds.includes(optId)
      ? selectedIds.filter((x) => x !== optId)
      : [...selectedIds, optId];
    onChange(next);
  };

  const activeCount = selectedIds.length;

  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={label}
        aria-expanded={undefined}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
          activeCount > 0
            ? 'bg-primary text-text-primary border-primary'
            : 'bg-surface-panel text-text-secondary border-border hover:bg-surface-hover'
        )}
      >
        {label}
        {activeCount > 0 && (
          <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs">{activeCount}</span>
        )}
        <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel — shown on hover/focus-within */}
      <div
        role="listbox"
        aria-label={label}
        aria-multiselectable="true"
        className="absolute top-full left-0 mt-1 min-w-40 bg-surface-panel border border-border rounded-lg shadow-lg py-1 z-20 hidden group-hover:block focus-within:block"
      >
        {options.map((opt) => {
          const checked = selectedIds.includes(opt.id);
          return (
            <label
              key={`${id}-${opt.id}`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.id)}
                className="rounded accent-primary"
              />
              {opt.displayName}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function YearRangeInputs({
  yearMin,
  yearMax,
  sliderMin,
  sliderMax,
  onChangeMin,
  onChangeMax,
}: {
  yearMin: number | undefined;
  yearMax: number | undefined;
  sliderMin: number;
  sliderMax: number;
  onChangeMin: (v: number | undefined) => void;
  onChangeMax: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted whitespace-nowrap">Year:</span>
      <input
        type="range"
        aria-label="Minimum year"
        min={sliderMin}
        max={sliderMax}
        value={yearMin ?? sliderMin}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChangeMin(v === sliderMin ? undefined : v);
        }}
        className="w-24 accent-primary"
      />
      <span className="text-xs text-text-secondary tabular-nums">
        {yearMin ?? sliderMin}–{yearMax ?? sliderMax}
      </span>
      <input
        type="range"
        aria-label="Maximum year"
        min={sliderMin}
        max={sliderMax}
        value={yearMax ?? sliderMax}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChangeMax(v === sliderMax ? undefined : v);
        }}
        className="w-24 accent-primary"
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCsvIds(csv: string | undefined): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function toCsvOrUndefined(ids: number[]): string | undefined {
  return ids.length > 0 ? ids.join(',') : undefined;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MediaFilterBar({
  filterState,
  setTitle,
  setHasFile,
  setMonitored,
  setSeriesStatus,
  setYearMin,
  setYearMax,
  setMovieTagIds,
  setSeriesTagIds,
  setMovieQualityProfileIds,
  setSeriesQualityProfileIds,
  clearAll,
  isActive,
  movieYearRange,
  seriesYearRange,
  lookups,
}: MediaFilterBarProps) {
  // Union year range for the slider bounds
  const globalMin = Math.min(
    movieYearRange?.min ?? 1900,
    seriesYearRange?.min ?? 1900
  );
  const globalMax = Math.max(
    movieYearRange?.max ?? new Date().getFullYear(),
    seriesYearRange?.max ?? new Date().getFullYear()
  );

  const movieTagIds = parseCsvIds(filterState.movieTagIds);
  const seriesTagIds = parseCsvIds(filterState.seriesTagIds);
  const movieQualityProfileIds = parseCsvIds(filterState.movieQualityProfileIds);
  const seriesQualityProfileIds = parseCsvIds(filterState.seriesQualityProfileIds);

  return (
    <div
      className="bg-surface-panel border-b border-border px-6 py-3"
      role="search"
      aria-label="Filter media library"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Title search */}
        <div className="relative flex-shrink-0">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            placeholder="Search titles…"
            aria-label="Search titles"
            value={filterState.title}
            onChange={(e) => setTitle(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-md text-xs bg-surface-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary w-44"
          />
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border flex-shrink-0" aria-hidden="true" />

        {/* Movie status */}
        <ChipGroup
          label="Movies"
          options={[
            { value: undefined, label: 'All' },
            { value: 'true' as const, label: 'Downloaded' },
            { value: 'false' as const, label: 'Missing' },
          ]}
          value={filterState.hasFile}
          onChange={setHasFile}
        />

        {/* Series monitored */}
        <ChipGroup
          label="Series"
          options={[
            { value: undefined, label: 'All' },
            { value: 'true' as const, label: 'Monitored' },
            { value: 'false' as const, label: 'Unmonitored' },
          ]}
          value={filterState.monitored}
          onChange={setMonitored}
        />

        {/* Series status */}
        <ChipGroup
          label="Status"
          options={[
            { value: undefined, label: 'All' },
            { value: 'continuing', label: 'Continuing' },
            { value: 'ended', label: 'Ended' },
          ]}
          value={filterState.seriesStatus}
          onChange={setSeriesStatus}
        />

        {/* Divider */}
        <div className="h-5 w-px bg-border flex-shrink-0" aria-hidden="true" />

        {/* Year range */}
        <YearRangeInputs
          yearMin={filterState.yearMin}
          yearMax={filterState.yearMax}
          sliderMin={globalMin}
          sliderMax={globalMax}
          onChangeMin={setYearMin}
          onChangeMax={setYearMax}
        />

        {/* Divider */}
        {(lookups.tags.radarr.length > 0 ||
          lookups.tags.sonarr.length > 0 ||
          lookups.qualityProfiles.radarr.length > 0 ||
          lookups.qualityProfiles.sonarr.length > 0) && (
          <div className="h-5 w-px bg-border flex-shrink-0" aria-hidden="true" />
        )}

        {/* Movie tags */}
        <MultiSelectDropdown
          label="Movie Tags"
          options={lookups.tags.radarr.map((t) => ({ id: t.id, displayName: t.label }))}
          selectedIds={movieTagIds}
          onChange={(ids) => setMovieTagIds(toCsvOrUndefined(ids))}
        />

        {/* Series tags */}
        <MultiSelectDropdown
          label="Series Tags"
          options={lookups.tags.sonarr.map((t) => ({ id: t.id, displayName: t.label }))}
          selectedIds={seriesTagIds}
          onChange={(ids) => setSeriesTagIds(toCsvOrUndefined(ids))}
        />

        {/* Movie quality profiles */}
        <MultiSelectDropdown
          label="Movie Quality"
          options={lookups.qualityProfiles.radarr.map((p) => ({ id: p.id, displayName: p.name }))}
          selectedIds={movieQualityProfileIds}
          onChange={(ids) => setMovieQualityProfileIds(toCsvOrUndefined(ids))}
        />

        {/* Series quality profiles */}
        <MultiSelectDropdown
          label="Series Quality"
          options={lookups.qualityProfiles.sonarr.map((p) => ({ id: p.id, displayName: p.name }))}
          selectedIds={seriesQualityProfileIds}
          onChange={(ids) => setSeriesQualityProfileIds(toCsvOrUndefined(ids))}
        />

        {/* Clear all */}
        {isActive && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-xs text-text-muted hover:text-text-primary transition-colors underline underline-offset-2"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
