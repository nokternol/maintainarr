import type { FilterState } from '@app/hooks/useMediaFilters';
import type { MediaQualityProfile, MediaTag } from '@app/hooks/useMediaLookups';
import { cn } from '@app/lib/utils/cn';
import { useEffect, useId, useRef, useState } from 'react';
import { OptionFilter } from '../filters/OptionFilter';

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

// ─── Separator ────────────────────────────────────────────────────────────────

function Sep() {
  return <div className="h-5 w-px bg-border flex-shrink-0" aria-hidden="true" />;
}

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────

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
  const menuId = `${id}-menu`;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  useEffect(() => {
    if (isOpen) {
      itemRefs.current[0]?.focus();
    }
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
        ref={triggerRef}
        type="button"
        aria-label={activeCount > 0 ? `${label}, ${activeCount} selected` : label}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            setIsOpen(false);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            else itemRefs.current[0]?.focus();
          } else if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          'flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium border transition-colors h-7',
          activeCount > 0
            ? 'bg-primary text-white border-primary'
            : 'bg-surface-panel text-text-secondary border-border hover:bg-surface-hover'
        )}
      >
        {label}
        {activeCount > 0 && (
          <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs" aria-hidden="true">
            {activeCount}
          </span>
        )}
        <svg
          className="w-3 h-3 ml-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          id={menuId}
          aria-label={label}
          className="absolute top-full left-0 mt-1 min-w-40 max-h-60 overflow-y-auto bg-surface-panel border border-border rounded-lg shadow-lg py-1 z-20"
        >
          {options.map((opt, index) => {
            const checked = selectedIds.includes(opt.id);
            return (
              <div
                key={`${id}-${opt.id}`}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="menuitemcheckbox"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => toggle(opt.id)}
                onKeyDown={(e) => {
                  switch (e.key) {
                    case 'Escape':
                      e.preventDefault();
                      setIsOpen(false);
                      triggerRef.current?.focus();
                      break;
                    case 'ArrowDown':
                      e.preventDefault();
                      itemRefs.current[Math.min(index + 1, options.length - 1)]?.focus();
                      break;
                    case 'ArrowUp':
                      e.preventDefault();
                      if (index === 0) triggerRef.current?.focus();
                      else itemRefs.current[index - 1]?.focus();
                      break;
                    case 'Enter':
                    case ' ':
                      e.preventDefault();
                      toggle(opt.id);
                      break;
                  }
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-xs text-text-secondary hover:bg-surface-hover focus:bg-surface-hover focus:outline-none cursor-pointer select-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-3.5 h-3.5 flex-shrink-0 rounded-sm border flex items-center justify-center',
                    checked ? 'bg-primary border-primary' : 'border-border bg-surface-bg'
                  )}
                >
                  {checked && (
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      className="w-full h-full p-0.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                {opt.displayName}
              </div>
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
  const menuId = `${id}-menu`;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  useEffect(() => {
    if (isOpen) {
      itemRefs.current[0]?.focus();
    }
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
        ref={triggerRef}
        type="button"
        aria-label={activeCount > 0 ? `${label}, ${activeCount} selected` : label}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            setIsOpen(false);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            else itemRefs.current[0]?.focus();
          } else if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          'flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium border transition-colors h-7',
          activeCount > 0
            ? 'bg-primary text-white border-primary'
            : 'bg-surface-panel text-text-secondary border-border hover:bg-surface-hover'
        )}
      >
        {label}
        {activeCount > 0 && (
          <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs" aria-hidden="true">
            {activeCount}
          </span>
        )}
        <svg
          className="w-3 h-3 ml-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          id={menuId}
          aria-label={label}
          className="absolute top-full left-0 mt-1 min-w-40 max-h-60 overflow-y-auto bg-surface-panel border border-border rounded-lg shadow-lg py-1 z-20"
        >
          {options.map((opt, index) => {
            const checked = selectedValues.includes(opt);
            return (
              <div
                key={`${id}-${opt}`}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="menuitemcheckbox"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => toggle(opt)}
                onKeyDown={(e) => {
                  switch (e.key) {
                    case 'Escape':
                      e.preventDefault();
                      setIsOpen(false);
                      triggerRef.current?.focus();
                      break;
                    case 'ArrowDown':
                      e.preventDefault();
                      itemRefs.current[Math.min(index + 1, options.length - 1)]?.focus();
                      break;
                    case 'ArrowUp':
                      e.preventDefault();
                      if (index === 0) triggerRef.current?.focus();
                      else itemRefs.current[index - 1]?.focus();
                      break;
                    case 'Enter':
                    case ' ':
                      e.preventDefault();
                      toggle(opt);
                      break;
                  }
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-xs text-text-secondary hover:bg-surface-hover focus:bg-surface-hover focus:outline-none cursor-pointer select-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-3.5 h-3.5 flex-shrink-0 rounded-sm border flex items-center justify-center',
                    checked ? 'bg-primary border-primary' : 'border-border bg-surface-bg'
                  )}
                >
                  {checked && (
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      className="w-full h-full p-0.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── YearRangeFilter ──────────────────────────────────────────────────────────

function parseYear(s: string): number | undefined {
  const n = Number.parseInt(s, 10);
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
}

function YearRangeFilter({
  yearMin,
  yearMax,
  dataMin,
  dataMax,
  onChangeMin,
  onChangeMax,
}: {
  yearMin: number | undefined;
  yearMax: number | undefined;
  dataMin: number | null;
  dataMax: number | null;
  onChangeMin: (v: number | undefined) => void;
  onChangeMax: (v: number | undefined) => void;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const draftMinRef = useRef('');
  const draftMaxRef = useRef('');
  const [draftMin, setDraftMinRaw] = useState('');
  const [draftMax, setDraftMaxRaw] = useState('');

  const isActive = yearMin !== undefined || yearMax !== undefined;

  const setDraftMin = (v: string) => {
    draftMinRef.current = v;
    setDraftMinRaw(v);
  };
  const setDraftMax = (v: string) => {
    draftMaxRef.current = v;
    setDraftMaxRaw(v);
  };

  useEffect(() => {
    if (!isOpen) return;
    const minStr = yearMin != null ? String(yearMin) : '';
    const maxStr = yearMax != null ? String(yearMax) : '';
    draftMinRef.current = minStr;
    draftMaxRef.current = maxStr;
    setDraftMinRaw(minStr);
    setDraftMaxRaw(maxStr);
    requestAnimationFrame(() => fromInputRef.current?.focus());
  }, [isOpen, yearMin, yearMax]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onChangeMin(parseYear(draftMinRef.current));
        onChangeMax(parseYear(draftMaxRef.current));
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onChangeMin, onChangeMax]);

  const commitAndClose = () => {
    onChangeMin(parseYear(draftMinRef.current));
    onChangeMax(parseYear(draftMaxRef.current));
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const clearAndClose = () => {
    draftMinRef.current = '';
    draftMaxRef.current = '';
    onChangeMin(undefined);
    onChangeMax(undefined);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitAndClose();
    }
  };

  const buttonLabel = isActive ? `${yearMin ?? '…'}–${yearMax ?? '…'}` : 'Year';
  const fromPlaceholder = dataMin != null ? String(dataMin) : 'Min';
  const toPlaceholder = dataMax != null ? String(dataMax) : 'Max';

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          isActive
            ? `Year filter: ${yearMin ?? 'any'} to ${yearMax ?? 'any'}, click to change`
            : 'Year filter'
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1 px-2.5 rounded-md text-xs font-medium border transition-colors h-7',
          isActive
            ? 'bg-primary text-white border-primary'
            : 'bg-surface-panel text-text-secondary border-border hover:bg-surface-hover'
        )}
      >
        <span className={isActive ? 'font-mono tabular-nums' : ''}>{buttonLabel}</span>
        <svg
          className="w-3 h-3 opacity-50 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Year range filter"
          className="absolute top-full left-0 mt-1 z-20 bg-surface-elevated border border-border rounded-lg p-3 w-48"
          style={{
            boxShadow:
              'inset 0 0 0 1px rgba(13,148,136,0.18), 0 4px 24px rgba(13,148,136,0.08), 0 1px 6px rgba(0,0,0,0.50)',
          }}
        >
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label
                htmlFor={`${id}-from`}
                className="block text-[10px] text-text-muted mb-1 select-none"
              >
                From
              </label>
              <input
                ref={fromInputRef}
                id={`${id}-from`}
                type="number"
                value={draftMin}
                placeholder={fromPlaceholder}
                onChange={(e) => setDraftMin(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-2 py-1.5 rounded text-xs bg-surface-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
              />
            </div>
            <span className="text-text-muted text-xs pb-[9px] flex-shrink-0">–</span>
            <div className="flex-1 min-w-0">
              <label
                htmlFor={`${id}-to`}
                className="block text-[10px] text-text-muted mb-1 select-none"
              >
                To
              </label>
              <input
                id={`${id}-to`}
                type="number"
                value={draftMax}
                placeholder={toPlaceholder}
                onChange={(e) => setDraftMax(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-2 py-1.5 rounded text-xs bg-surface-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <button
              type="button"
              onClick={clearAndClose}
              disabled={!isActive && !draftMin && !draftMax}
              className={cn(
                'text-[10px] transition-colors underline underline-offset-2',
                isActive || draftMin || draftMax
                  ? 'text-text-muted hover:text-text-primary'
                  : 'text-text-muted/30 pointer-events-none'
              )}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={commitAndClose}
              className="text-xs font-medium px-3 py-1 rounded bg-primary text-white hover:bg-primary-hover transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-1 focus:ring-offset-surface-elevated"
            >
              Apply
            </button>
          </div>
        </div>
      )}
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
  const id = useId();
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label htmlFor={`${id}-from`} className="block text-xs text-text-muted mb-1.5">
          From
        </label>
        <input
          id={`${id}-from`}
          type="number"
          placeholder={String(globalMin)}
          value={yearMin !== undefined ? yearMin : ''}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            setYearMin(Number.isNaN(v) ? undefined : v);
          }}
          className="w-full px-3 py-2.5 rounded-md text-sm bg-surface-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <span className="text-text-muted pb-3">–</span>
      <div className="flex-1">
        <label htmlFor={`${id}-to`} className="block text-xs text-text-muted mb-1.5">
          To
        </label>
        <input
          id={`${id}-to`}
          type="number"
          placeholder={String(globalMax)}
          value={yearMax !== undefined ? yearMax : ''}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            setYearMax(Number.isNaN(v) ? undefined : v);
          }}
          className="w-full px-3 py-2.5 rounded-md text-sm bg-surface-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
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
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toStringCsvOrUndefined(values: string[]): string | undefined {
  return values.length > 0 ? values.join(',') : undefined;
}

// ─── Option sets (shared between desktop and mobile) ─────────────────────────

const HAS_FILE_OPTIONS = [
  { value: 'true' as const, label: 'Downloaded' },
  { value: 'false' as const, label: 'Missing' },
];

const MONITORED_OPTIONS = [
  { value: 'true' as const, label: 'Monitored' },
  { value: 'false' as const, label: 'Unmonitored' },
];

const SERIES_STATUS_OPTIONS = [
  { value: 'continuing', label: 'Continuing' },
  { value: 'ended', label: 'Ended' },
];

const SERIES_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'anime', label: 'Anime' },
  { value: 'daily', label: 'Daily' },
];

const TAUTULLI_WATCHED_OPTIONS = [
  { value: 'true' as const, label: 'Watched' },
  { value: 'false' as const, label: 'Unwatched' },
];

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
  const availableMins = [movieYearRange?.min, seriesYearRange?.min].filter(
    (v): v is number => v != null
  );
  const availableMaxs = [movieYearRange?.max, seriesYearRange?.max].filter(
    (v): v is number => v != null
  );
  const dataMin: number | null = availableMins.length > 0 ? Math.min(...availableMins) : null;
  const dataMax: number | null = availableMaxs.length > 0 ? Math.max(...availableMaxs) : null;
  const globalMin = dataMin ?? 1888;
  const globalMax = dataMax ?? new Date().getFullYear();

  const movieTagIds = parseCsvIds(filterState.movieTagIds);
  const seriesTagIds = parseCsvIds(filterState.seriesTagIds);
  const movieQualityProfileIds = parseCsvIds(filterState.movieQualityProfileIds);
  const seriesQualityProfileIds = parseCsvIds(filterState.seriesQualityProfileIds);
  const selectedMovieGenres = parseCsvStrings(filterState.movieGenres);
  const selectedSeriesGenres = parseCsvStrings(filterState.seriesGenres);
  const selectedNetworks = parseCsvStrings(filterState.network);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogHeadingId = useId();
  const onMobileCloseRef = useRef(onMobileClose);
  useEffect(() => {
    onMobileCloseRef.current = onMobileClose;
  });

  useEffect(() => {
    if (mobileOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen || !dialogRef.current) return;
    const sel = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    dialogRef.current.querySelectorAll<HTMLElement>(sel)[0]?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const sel = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(sel));
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onMobileCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const hasMovieSection =
    configuredTypes.has('RADARR') && (activeTab === undefined || activeTab === 'movies');
  const hasSeriesSection =
    configuredTypes.has('SONARR') && (activeTab === undefined || activeTab === 'series');
  const hasTautulliSection = configuredTypes.has('TAUTULLI');

  const hasMovieDropdowns =
    lookups.tags.radarr.length > 0 || lookups.qualityProfiles.radarr.length > 0;
  const hasSeriesDropdowns =
    lookups.tags.sonarr.length > 0 || lookups.qualityProfiles.sonarr.length > 0;

  // When only one type is visible (typical case: activeTab is always set in MediaContent),
  // collapse to a single row so the year slider isn't orphaned on its own row.
  const bothTypes = hasMovieSection && hasSeriesSection;

  // ─── Shared sub-elements ─────────────────────────────────────────────────

  const searchInput = (
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
  );

  const movieGroup = hasMovieSection ? (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-surface-bg/40 border border-border rounded-lg px-3 py-1">
      <OptionFilter
        label="Movies"
        options={HAS_FILE_OPTIONS}
        value={filterState.hasFile}
        onChange={setHasFile}
      />
      {hasMovieDropdowns && (
        <>
          <MultiSelectDropdown
            label="Movie Tags"
            options={lookups.tags.radarr.map((t) => ({
              id: t.id,
              displayName: t.label,
            }))}
            selectedIds={movieTagIds}
            onChange={(ids) => setMovieTagIds(toCsvOrUndefined(ids))}
          />
          <MultiSelectDropdown
            label="Movie Quality"
            options={lookups.qualityProfiles.radarr.map((p) => ({
              id: p.id,
              displayName: p.name,
            }))}
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
  ) : null;

  const seriesGroup = hasSeriesSection ? (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-surface-bg/40 border border-border rounded-lg px-3 py-1">
      <OptionFilter
        label="Series"
        options={MONITORED_OPTIONS}
        value={filterState.monitored}
        onChange={setMonitored}
      />
      <OptionFilter
        label="Status"
        options={SERIES_STATUS_OPTIONS}
        value={filterState.seriesStatus}
        onChange={setSeriesStatus}
      />
      <OptionFilter
        label="Type"
        options={SERIES_TYPE_OPTIONS}
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
            options={lookups.qualityProfiles.sonarr.map((p) => ({
              id: p.id,
              displayName: p.name,
            }))}
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
  ) : null;

  const yearFilter = (
    <YearRangeFilter
      yearMin={filterState.yearMin}
      yearMax={filterState.yearMax}
      dataMin={dataMin}
      dataMax={dataMax}
      onChangeMin={setYearMin}
      onChangeMax={setYearMax}
    />
  );

  const tautulliFilter = hasTautulliSection ? (
    <OptionFilter
      options={TAUTULLI_WATCHED_OPTIONS}
      value={filterState.tautulliWatched}
      onChange={setTautulliWatched}
    />
  ) : null;

  const clearAllButton = isActive ? (
    <button
      type="button"
      onClick={clearAll}
      className="ml-auto text-xs text-text-muted hover:text-text-primary transition-colors underline underline-offset-2"
    >
      Clear all
    </button>
  ) : null;

  return (
    <>
      {/* ── Desktop filter bar (md+) ─────────────────────────────────────────── */}
      <div
        className="hidden md:block bg-surface-panel border-b border-border px-6 py-2"
        role="search"
        aria-label="Filter media library"
      >
        {bothTypes ? (
          // Two-row layout: both movies and series sections visible simultaneously.
          // Row 1: search + movies + tautulli + clear-all
          // Row 2: series + year slider
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1.5">
              {searchInput}
              {movieGroup && (
                <>
                  <Sep />
                  {movieGroup}
                </>
              )}
              {tautulliFilter && (
                <>
                  <Sep />
                  {tautulliFilter}
                </>
              )}
              {clearAllButton}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {seriesGroup}
              <Sep />
              {yearFilter}
            </div>
          </div>
        ) : (
          // Single-row layout: only one type section visible (or neither).
          // Search | type-group | year-slider | tautulli | clear-all
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {searchInput}
            {movieGroup && (
              <>
                <Sep />
                {movieGroup}
              </>
            )}
            {seriesGroup && (
              <>
                <Sep />
                {seriesGroup}
              </>
            )}
            {(hasMovieSection || hasSeriesSection) && <Sep />}
            {yearFilter}
            {tautulliFilter && (
              <>
                <Sep />
                {tautulliFilter}
              </>
            )}
            {clearAllButton}
          </div>
        )}
      </div>

      {/* ── Mobile full-screen filter modal (< md) ──────────────────────────── */}
      {mobileOpen && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 md:hidden bg-surface-panel flex flex-col pb-16"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogHeadingId}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <h2 id={dialogHeadingId} className="text-base font-semibold text-text-primary">
              Filters
            </h2>
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
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Movies</h3>
                <div className="space-y-3">
                  <OptionFilter
                    variant="chips"
                    options={HAS_FILE_OPTIONS}
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
                      options={lookups.qualityProfiles.radarr.map((p) => ({
                        id: p.id,
                        displayName: p.name,
                      }))}
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
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Series</h3>
                <div className="space-y-3">
                  <OptionFilter
                    variant="chips"
                    options={MONITORED_OPTIONS}
                    value={filterState.monitored}
                    onChange={setMonitored}
                  />
                  <div>
                    <span className="text-xs text-text-muted mb-2 block">Status</span>
                    <OptionFilter
                      variant="chips"
                      options={SERIES_STATUS_OPTIONS}
                      value={filterState.seriesStatus}
                      onChange={setSeriesStatus}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-text-muted mb-2 block">Type</span>
                    <OptionFilter
                      variant="chips"
                      options={SERIES_TYPE_OPTIONS}
                      value={filterState.seriesType}
                      onChange={setSeriesType}
                    />
                  </div>
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
                      options={lookups.qualityProfiles.sonarr.map((p) => ({
                        id: p.id,
                        displayName: p.name,
                      }))}
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
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Play History</h3>
                <OptionFilter
                  variant="chips"
                  options={TAUTULLI_WATCHED_OPTIONS}
                  value={filterState.tautulliWatched}
                  onChange={setTautulliWatched}
                />
              </div>
            )}

            {/* Year section */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Year Range</h3>
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
