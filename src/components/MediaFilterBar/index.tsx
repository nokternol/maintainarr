import type { FilterState } from '@app/hooks/useMediaFilters';
import type { MediaQualityProfile, MediaTag } from '@app/hooks/useMediaLookups';
import { cn } from '@app/lib/utils/cn';
import Slider from 'rc-slider';
import { useEffect, useId, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearRange {
  min: number | null;
  max: number | null;
}

interface Lookups {
  tags: { radarr: MediaTag[]; sonarr: MediaTag[] };
  qualityProfiles: { radarr: MediaQualityProfile[]; sonarr: MediaQualityProfile[] };
  genres: { movies: string[]; series: string[] };
  networks: string[];
}

export interface MediaFilterBarProps {
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
  setMovieGenres: (v: string | undefined) => void;
  setSeriesGenres: (v: string | undefined) => void;
  setSeriesType: (v: string | undefined) => void;
  setNetwork: (v: string | undefined) => void;
  setTautulliWatched: (v: 'true' | 'false' | undefined) => void;
  clearAll: () => void;
  isActive: boolean;
  movieYearRange: YearRange | null;
  seriesYearRange: YearRange | null;
  lookups: Lookups;
  /** Set of active provider types, used to gate filter sections */
  configuredTypes: Set<string>;
  /** Scopes visible filter groups to the active tab. Omit to show all. */
  activeTab?: 'movies' | 'series';
  /** Mobile bottom sheet open state */
  mobileOpen?: boolean;
  /** Callback to close the mobile bottom sheet */
  onMobileClose?: () => void;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ChipGroup<T extends string | undefined>({
  label,
  options,
  value,
  onChange,
  hideLabel,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!hideLabel && <span className="text-xs text-text-muted whitespace-nowrap">{label}:</span>}
      {options.map((opt) => (
        <button
          key={String(opt.value ?? 'all')}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-2 rounded-sm text-xs font-medium transition-colors min-h-[44px] flex items-center',
            value === opt.value
              ? 'bg-primary text-white'
              : 'bg-surface-panel text-text-primary hover:bg-surface-hover border border-border'
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (options.length === 0) return null;

  const toggle = (optId: number) => {
    const next = selectedIds.includes(optId)
      ? selectedIds.filter((x) => x !== optId)
      : [...selectedIds, optId];
    onChange(next);
  };

  const activeCount = selectedIds.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-medium border transition-colors min-h-[44px]',
          activeCount > 0
            ? 'bg-primary text-white border-primary'
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

      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute top-full left-0 mt-1 min-w-40 max-h-60 overflow-y-auto bg-surface-panel border border-border rounded-lg shadow-lg py-1 z-20"
        >
          {options.map((opt) => {
            const checked = selectedIds.includes(opt.id);
            return (
              <label
                key={`${id}-${opt.id}`}
                className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
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
      )}
    </div>
  );
}

function StringMultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (options.length === 0) return null;

  const toggle = (value: string) => {
    const next = selectedValues.includes(value)
      ? selectedValues.filter((x) => x !== value)
      : [...selectedValues, value];
    onChange(next);
  };

  const activeCount = selectedValues.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-medium border transition-colors min-h-[44px]',
          activeCount > 0
            ? 'bg-primary text-white border-primary'
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

      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute top-full left-0 mt-1 min-w-40 max-h-60 overflow-y-auto bg-surface-panel border border-border rounded-lg shadow-lg py-1 z-20"
        >
          {options.map((opt) => {
            const checked = selectedValues.includes(opt);
            return (
              <label
                key={`${id}-${opt}`}
                className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt)}
                  className="rounded accent-primary"
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SLIDER_STYLES = {
  rail: { backgroundColor: 'var(--color-border)', height: 4 },
  track: { backgroundColor: 'var(--color-primary)', height: 4 },
  handle: {
    backgroundColor: 'var(--color-surface-panel)',
    borderColor: 'var(--color-primary)',
    borderWidth: 2,
    opacity: 1,
    width: 24,
    height: 24,
    marginTop: -10,
    boxShadow: 'none',
  },
};

function YearRangeSlider({
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
  const [draft, setDraft] = useState<[number, number]>([
    yearMin ?? sliderMin,
    yearMax ?? sliderMax,
  ]);
  const [bounds, setBounds] = useState({ min: sliderMin, max: sliderMax });
  const isDragging = useRef(false);

  useEffect(() => {
    if (isDragging.current) return;
    setBounds({ min: sliderMin, max: sliderMax });
    setDraft([yearMin ?? sliderMin, yearMax ?? sliderMax]);
  }, [yearMin, yearMax, sliderMin, sliderMax]);

  const commit = (v: number | number[]) => {
    isDragging.current = false;
    const [min, max] = v as [number, number];
    onChangeMin(min === bounds.min ? undefined : min);
    onChangeMax(max === bounds.max ? undefined : max);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-muted whitespace-nowrap">Year:</span>
      <div className="w-36 py-1" aria-label="Year range">
        <Slider
          range
          min={bounds.min}
          max={bounds.max}
          value={draft}
          onChange={(v) => {
            isDragging.current = true;
            setDraft(v as [number, number]);
          }}
          onChangeComplete={commit}
          styles={SLIDER_STYLES}
          allowCross={false}
        />
      </div>
      <span className="text-xs text-text-secondary tabular-nums w-20">
        {draft[0]}–{draft[1]}
      </span>
    </div>
  );
}

// ─── Mobile year inputs — better UX on touch than a 144px slider ──────────────

function MobileYearInputs({
  yearMin,
  yearMax,
  globalMin,
  globalMax,
  setYearMin,
  setYearMax,
}: {
  yearMin: number | undefined;
  yearMax: number | undefined;
  globalMin: number;
  globalMax: number;
  setYearMin: (v: number | undefined) => void;
  setYearMax: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs text-text-muted mb-1.5">From</label>
        <input
          type="number"
          min={globalMin}
          max={globalMax}
          value={yearMin ?? globalMin}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            setYearMin(Number.isNaN(v) || v <= globalMin ? undefined : v);
          }}
          className="w-full px-3 py-2.5 rounded-md text-sm bg-surface-bg border border-border text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <span className="text-text-muted pb-3">–</span>
      <div className="flex-1">
        <label className="block text-xs text-text-muted mb-1.5">To</label>
        <input
          type="number"
          min={globalMin}
          max={globalMax}
          value={yearMax ?? globalMax}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            setYearMax(Number.isNaN(v) || v >= globalMax ? undefined : v);
          }}
          className="w-full px-3 py-2.5 rounded-md text-sm bg-surface-bg border border-border text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
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

function parseCsvStrings(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

function toStringCsvOrUndefined(values: string[]): string | undefined {
  return values.length > 0 ? values.join(',') : undefined;
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
  setMovieGenres,
  setSeriesGenres,
  setSeriesType,
  setNetwork,
  setTautulliWatched,
  clearAll,
  isActive,
  movieYearRange,
  seriesYearRange,
  lookups,
  configuredTypes,
  activeTab,
  mobileOpen = false,
  onMobileClose,
}: MediaFilterBarProps) {
  const availableMins = [movieYearRange?.min, seriesYearRange?.min].filter((v): v is number => v != null);
  const availableMaxs = [movieYearRange?.max, seriesYearRange?.max].filter((v): v is number => v != null);
  const globalMin = availableMins.length > 0 ? Math.min(...availableMins) : 1888;
  const globalMax = availableMaxs.length > 0 ? Math.max(...availableMaxs) : new Date().getFullYear();

  const movieTagIds = parseCsvIds(filterState.movieTagIds);
  const seriesTagIds = parseCsvIds(filterState.seriesTagIds);
  const movieQualityProfileIds = parseCsvIds(filterState.movieQualityProfileIds);
  const seriesQualityProfileIds = parseCsvIds(filterState.seriesQualityProfileIds);
  const selectedMovieGenres = parseCsvStrings(filterState.movieGenres);
  const selectedSeriesGenres = parseCsvStrings(filterState.seriesGenres);
  const selectedNetworks = parseCsvStrings(filterState.network);

  const hasMovieSection = configuredTypes.has('RADARR') && (activeTab === undefined || activeTab === 'movies');
  const hasSeriesSection = configuredTypes.has('SONARR') && (activeTab === undefined || activeTab === 'series');
  const hasTautulliSection = configuredTypes.has('TAUTULLI');

  const hasMovieDropdowns =
    lookups.tags.radarr.length > 0 || lookups.qualityProfiles.radarr.length > 0;
  const hasSeriesDropdowns =
    lookups.tags.sonarr.length > 0 || lookups.qualityProfiles.sonarr.length > 0;

  return (
    <>
      {/* ── Desktop filter bar (md+): two-row structured layout ─────────────── */}
      <div
        className="hidden md:block bg-surface-panel border-b border-border px-6 py-3"
        role="search"
        aria-label="Filter media library"
      >
        <div className="relative">
          {/* Clear all — anchored top-right of the bar */}
          {isActive && (
            <button
              type="button"
              onClick={clearAll}
              className="absolute top-0 right-0 text-xs text-text-muted hover:text-text-primary transition-colors underline underline-offset-2"
            >
              Clear all
            </button>
          )}

          {/* Row 1: Search + Movie filters */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
            {/* Search input */}
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
                placeholder="Filter by title…"
                aria-label="Filter by title"
                value={filterState.title}
                onChange={(e) => setTitle(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-md text-xs bg-surface-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary w-44"
              />
            </div>

            {hasMovieSection && (
              <>
                <div className="h-5 w-px bg-border flex-shrink-0" aria-hidden="true" />

                {/* Movie filter group */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-surface-bg/40 rounded-lg px-3 py-1.5">
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
                  {hasMovieDropdowns && (
                    <>
                      <MultiSelectDropdown
                        label="Movie Tags"
                        options={lookups.tags.radarr.map((t) => ({ id: t.id, displayName: t.label }))}
                        selectedIds={movieTagIds}
                        onChange={(ids) => setMovieTagIds(toCsvOrUndefined(ids))}
                      />
                      <MultiSelectDropdown
                        label="Movie Quality"
                        options={lookups.qualityProfiles.radarr.map((p) => ({ id: p.id, displayName: p.name }))}
                        selectedIds={movieQualityProfileIds}
                        onChange={(ids) => setMovieQualityProfileIds(toCsvOrUndefined(ids))}
                      />
                    </>
                  )}
                  <StringMultiSelectDropdown
                    label="Movie Genres"
                    options={lookups.genres.movies}
                    selectedValues={selectedMovieGenres}
                    onChange={(v) => setMovieGenres(toStringCsvOrUndefined(v))}
                  />
                </div>
              </>
            )}

            {hasTautulliSection && (
              <>
                <div className="h-5 w-px bg-border flex-shrink-0" aria-hidden="true" />
                <ChipGroup
                  label="Watched"
                  options={[
                    { value: undefined, label: 'All' },
                    { value: 'true' as const, label: 'Watched' },
                    { value: 'false' as const, label: 'Unwatched' },
                  ]}
                  value={filterState.tautulliWatched}
                  onChange={setTautulliWatched}
                />
              </>
            )}
          </div>

          {/* Row 2: Series filters + Year slider */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {hasSeriesSection && (
              /* Series filter group */
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-surface-bg/40 rounded-lg px-3 py-1.5">
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
                <ChipGroup
                  label="Type"
                  options={[
                    { value: undefined, label: 'All' },
                    { value: 'standard', label: 'Standard' },
                    { value: 'anime', label: 'Anime' },
                    { value: 'daily', label: 'Daily' },
                  ]}
                  value={filterState.seriesType}
                  onChange={setSeriesType}
                />
                {hasSeriesDropdowns && (
                  <>
                    <MultiSelectDropdown
                      label="Series Tags"
                      options={lookups.tags.sonarr.map((t) => ({ id: t.id, displayName: t.label }))}
                      selectedIds={seriesTagIds}
                      onChange={(ids) => setSeriesTagIds(toCsvOrUndefined(ids))}
                    />
                    <MultiSelectDropdown
                      label="Series Quality"
                      options={lookups.qualityProfiles.sonarr.map((p) => ({ id: p.id, displayName: p.name }))}
                      selectedIds={seriesQualityProfileIds}
                      onChange={(ids) => setSeriesQualityProfileIds(toCsvOrUndefined(ids))}
                    />
                  </>
                )}
                <StringMultiSelectDropdown
                  label="Series Genres"
                  options={lookups.genres.series}
                  selectedValues={selectedSeriesGenres}
                  onChange={(v) => setSeriesGenres(toStringCsvOrUndefined(v))}
                />
                <StringMultiSelectDropdown
                  label="Network"
                  options={lookups.networks}
                  selectedValues={selectedNetworks}
                  onChange={(v) => setNetwork(toStringCsvOrUndefined(v))}
                />
              </div>
            )}

            {(hasMovieSection || hasSeriesSection) && (
              <div className="h-5 w-px bg-border flex-shrink-0" aria-hidden="true" />
            )}

            <YearRangeSlider
              yearMin={filterState.yearMin}
              yearMax={filterState.yearMax}
              sliderMin={globalMin}
              sliderMax={globalMax}
              onChangeMin={setYearMin}
              onChangeMax={setYearMax}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile full-screen filter modal (< md) ──────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-surface-panel flex flex-col pb-16"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <h2 className="text-base font-semibold text-text-primary">Filters</h2>
            {isActive && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Search */}
              <div>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
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
                    placeholder="Filter by title…"
                    aria-label="Filter by title"
                    value={filterState.title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-lg text-sm bg-surface-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Movies section */}
              {hasMovieSection && (
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">
                    Movies
                  </h3>
                  <div className="space-y-3">
                    <ChipGroup
                      label="Movies"
                      hideLabel
                      options={[
                        { value: undefined, label: 'All' },
                        { value: 'true' as const, label: 'Downloaded' },
                        { value: 'false' as const, label: 'Missing' },
                      ]}
                      value={filterState.hasFile}
                      onChange={setHasFile}
                    />
                    {lookups.tags.radarr.length > 0 && (
                      <MultiSelectDropdown
                        label="Movie Tags"
                        options={lookups.tags.radarr.map((t) => ({ id: t.id, displayName: t.label }))}
                        selectedIds={movieTagIds}
                        onChange={(ids) => setMovieTagIds(toCsvOrUndefined(ids))}
                      />
                    )}
                    {lookups.qualityProfiles.radarr.length > 0 && (
                      <MultiSelectDropdown
                        label="Movie Quality"
                        options={lookups.qualityProfiles.radarr.map((p) => ({ id: p.id, displayName: p.name }))}
                        selectedIds={movieQualityProfileIds}
                        onChange={(ids) => setMovieQualityProfileIds(toCsvOrUndefined(ids))}
                      />
                    )}
                    <StringMultiSelectDropdown
                      label="Movie Genres"
                      options={lookups.genres.movies}
                      selectedValues={selectedMovieGenres}
                      onChange={(v) => setMovieGenres(toStringCsvOrUndefined(v))}
                    />
                  </div>
                </div>
              )}

              {/* Series section */}
              {hasSeriesSection && (
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">
                    Series
                  </h3>
                  <div className="space-y-3">
                    <ChipGroup
                      label="Series"
                      hideLabel
                      options={[
                        { value: undefined, label: 'All' },
                        { value: 'true' as const, label: 'Monitored' },
                        { value: 'false' as const, label: 'Unmonitored' },
                      ]}
                      value={filterState.monitored}
                      onChange={setMonitored}
                    />
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
                    <ChipGroup
                      label="Type"
                      options={[
                        { value: undefined, label: 'All' },
                        { value: 'standard', label: 'Standard' },
                        { value: 'anime', label: 'Anime' },
                        { value: 'daily', label: 'Daily' },
                      ]}
                      value={filterState.seriesType}
                      onChange={setSeriesType}
                    />
                    {lookups.tags.sonarr.length > 0 && (
                      <MultiSelectDropdown
                        label="Series Tags"
                        options={lookups.tags.sonarr.map((t) => ({ id: t.id, displayName: t.label }))}
                        selectedIds={seriesTagIds}
                        onChange={(ids) => setSeriesTagIds(toCsvOrUndefined(ids))}
                      />
                    )}
                    {lookups.qualityProfiles.sonarr.length > 0 && (
                      <MultiSelectDropdown
                        label="Series Quality"
                        options={lookups.qualityProfiles.sonarr.map((p) => ({ id: p.id, displayName: p.name }))}
                        selectedIds={seriesQualityProfileIds}
                        onChange={(ids) => setSeriesQualityProfileIds(toCsvOrUndefined(ids))}
                      />
                    )}
                    <StringMultiSelectDropdown
                      label="Series Genres"
                      options={lookups.genres.series}
                      selectedValues={selectedSeriesGenres}
                      onChange={(v) => setSeriesGenres(toStringCsvOrUndefined(v))}
                    />
                    <StringMultiSelectDropdown
                      label="Network"
                      options={lookups.networks}
                      selectedValues={selectedNetworks}
                      onChange={(v) => setNetwork(toStringCsvOrUndefined(v))}
                    />
                  </div>
                </div>
              )}

              {/* Tautulli Watched section */}
              {hasTautulliSection && (
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">
                    Play History
                  </h3>
                  <ChipGroup
                    label="Watched"
                    options={[
                      { value: undefined, label: 'All' },
                      { value: 'true' as const, label: 'Watched' },
                      { value: 'false' as const, label: 'Unwatched' },
                    ]}
                    value={filterState.tautulliWatched}
                    onChange={setTautulliWatched}
                  />
                </div>
              )}

              {/* Year section */}
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-3">
                  Year Range
                </h3>
                <MobileYearInputs
                  yearMin={filterState.yearMin}
                  yearMax={filterState.yearMax}
                  globalMin={globalMin}
                  globalMax={globalMax}
                  setYearMin={setYearMin}
                  setYearMax={setYearMax}
                />
              </div>
            </div>

          {/* Sticky Done footer */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-border">
            <button
              type="button"
              onClick={onMobileClose}
              className="w-full py-3 rounded-sm bg-primary text-white font-semibold text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
