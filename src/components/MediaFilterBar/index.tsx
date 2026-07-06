import type { MediaQualityProfile, MediaTag } from '@app/hooks/useMediaLookups';
import { cn } from '@app/lib/utils/cn';
import { useEffect, useId, useRef, useState } from 'react';
// Temporary: FilterState here is the pre-Stage-2d flat shape, aliased from the
// bridge in src/pages/media/legacyFilterBridge.ts (not the registry-derived
// FilterState in @app/hooks/useMediaFilters). Deleted when 2d collapses this
// component's ~33 props to onRuleChange(key, value).
import type { LegacyFilterState as FilterState } from '../../pages/media/legacyFilterBridge';
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
  setLastWatchedDaysAgoGte: (v: number | undefined) => void;
  setLastWatchedDaysAgoLte: (v: number | undefined) => void;
  setOverseerrHasIssue: (v: 'true' | 'false' | undefined) => void;
  setOverseerrRequestStatus: (v: string | undefined) => void;
  setTmdbStatus: (v: string | undefined) => void;
  // ── Shared (movies + series) ─────────────────────────────────────────────
  setAddedDaysAgoGte: (v: number | undefined) => void;
  setAddedDaysAgoLte: (v: number | undefined) => void;
  setSizeOnDiskGbGte: (v: number | undefined) => void;
  setSizeOnDiskGbLte: (v: number | undefined) => void;
  setCertification: (v: string | undefined) => void;
  // ── Movie-specific ───────────────────────────────────────────────────────
  setRadarrImdbRatingGte: (v: number | undefined) => void;
  setRadarrImdbRatingLte: (v: number | undefined) => void;
  // ── Series-specific ──────────────────────────────────────────────────────
  setSonarrRatingGte: (v: number | undefined) => void;
  setSonarrRatingLte: (v: number | undefined) => void;
  setSonarrEnded: (v: 'true' | 'false' | undefined) => void;
  setSonarrLastAiredDaysAgoGte: (v: number | undefined) => void;
  setSonarrLastAiredDaysAgoLte: (v: number | undefined) => void;
  setSonarrPercentEpisodesGte: (v: number | undefined) => void;
  setSonarrPercentEpisodesLte: (v: number | undefined) => void;
  clearAll: () => void;
  onSaveQuery?: () => void;
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

// ─── FilterGroup ──────────────────────────────────────────────────────────────
//
// Labeled container that clusters one provider source's filters. The small
// uppercase label answers "which source does this filter belong to?" at a
// glance, mirroring the provider grouping used in AutomationBuilder. Replaces
// the old free-floating dividers, which broke apart when the row wrapped.

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-divider bg-surface-bg/40 px-2.5 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap select-none">
        {label}
      </span>
      <span className="h-4 w-px bg-divider flex-shrink-0" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{children}</div>
    </div>
  );
}

// ─── ChipX — clear icon for the active-condition chips ────────────────────────

function ChipX() {
  return (
    <svg
      viewBox="0 0 10 10"
      className="w-2.5 h-2.5 flex-shrink-0 opacity-70"
      fill="none"
      aria-hidden="true"
    >
      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
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

// ─── NumberRangeFilter ────────────────────────────────────────────────────────

function parseNumber(s: string): number | undefined {
  const n = Number.parseFloat(s);
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
}

function NumberRangeFilter({
  label,
  min,
  max,
  dataMin = null,
  dataMax = null,
  onChangeMin,
  onChangeMax,
}: {
  label: string;
  min: number | undefined;
  max: number | undefined;
  dataMin?: number | null;
  dataMax?: number | null;
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

  const isActive = min !== undefined || max !== undefined;

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
    const minStr = min != null ? String(min) : '';
    const maxStr = max != null ? String(max) : '';
    draftMinRef.current = minStr;
    draftMaxRef.current = maxStr;
    setDraftMinRaw(minStr);
    setDraftMaxRaw(maxStr);
    requestAnimationFrame(() => fromInputRef.current?.focus());
  }, [isOpen, min, max]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onChangeMin(parseNumber(draftMinRef.current));
        onChangeMax(parseNumber(draftMaxRef.current));
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onChangeMin, onChangeMax]);

  const commitAndClose = () => {
    onChangeMin(parseNumber(draftMinRef.current));
    onChangeMax(parseNumber(draftMaxRef.current));
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

  const buttonLabel = isActive ? `${min ?? '…'}–${max ?? '…'}` : label;
  const fromPlaceholder = dataMin != null ? String(dataMin) : 'Min';
  const toPlaceholder = dataMax != null ? String(dataMax) : 'Max';

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          isActive
            ? `${label} filter: ${min ?? 'any'} to ${max ?? 'any'}, click to change`
            : `${label} filter`
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
          aria-label={`${label} range filter`}
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

const SONARR_ENDED_OPTIONS = [
  { value: 'true' as const, label: 'Finished' },
  { value: 'false' as const, label: 'Running' },
];

const OVERSEERR_HAS_ISSUE_OPTIONS = [
  { value: 'true' as const, label: 'Has Issue' },
  { value: 'false' as const, label: 'No Issue' },
];

const OVERSEERR_REQUEST_STATUS_OPTIONS = [
  { value: '1', label: 'Pending' },
  { value: '2', label: 'Approved' },
  { value: '3', label: 'Declined' },
  { value: '4', label: 'Available' },
];

const TMDB_STATUS_OPTIONS = [
  { value: 'Released', label: 'Released' },
  { value: 'In Production', label: 'In Production' },
  { value: 'Ended', label: 'Ended' },
  { value: 'Returning Series', label: 'Returning Series' },
  { value: 'Canceled', label: 'Canceled' },
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
  setLastWatchedDaysAgoGte,
  setLastWatchedDaysAgoLte,
  setOverseerrHasIssue,
  setOverseerrRequestStatus,
  setTmdbStatus,
  setAddedDaysAgoGte,
  setAddedDaysAgoLte,
  setSizeOnDiskGbGte,
  setSizeOnDiskGbLte,
  setRadarrImdbRatingGte,
  setRadarrImdbRatingLte,
  setSonarrRatingGte,
  setSonarrRatingLte,
  setSonarrEnded,
  setSonarrLastAiredDaysAgoGte,
  setSonarrLastAiredDaysAgoLte,
  setSonarrPercentEpisodesGte,
  setSonarrPercentEpisodesLte,
  clearAll,
  onSaveQuery,
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
  const hasPlayHistorySection = configuredTypes.has('TAUTULLI') || configuredTypes.has('PLEX');
  const hasOverseerrSection = configuredTypes.has('OVERSEERR');
  const hasTmdbSection = configuredTypes.has('TMDB');

  const hasMovieDropdowns =
    lookups.tags.radarr.length > 0 || lookups.qualityProfiles.radarr.length > 0;
  const hasSeriesDropdowns =
    lookups.tags.sonarr.length > 0 || lookups.qualityProfiles.sonarr.length > 0;

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
    <FilterGroup label="Movies">
      <OptionFilter options={HAS_FILE_OPTIONS} value={filterState.hasFile} onChange={setHasFile} />
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
      <NumberRangeFilter
        label="Added"
        min={filterState.addedDaysAgoGte}
        max={filterState.addedDaysAgoLte}
        onChangeMin={setAddedDaysAgoGte}
        onChangeMax={setAddedDaysAgoLte}
      />
      <NumberRangeFilter
        label="Size (GB)"
        min={filterState.sizeOnDiskGbGte}
        max={filterState.sizeOnDiskGbLte}
        onChangeMin={setSizeOnDiskGbGte}
        onChangeMax={setSizeOnDiskGbLte}
      />
      <NumberRangeFilter
        label="IMDB Rating"
        min={filterState.radarrImdbRatingGte}
        max={filterState.radarrImdbRatingLte}
        onChangeMin={setRadarrImdbRatingGte}
        onChangeMax={setRadarrImdbRatingLte}
      />
    </FilterGroup>
  ) : null;

  const seriesGroup = hasSeriesSection ? (
    <FilterGroup label="Series">
      <OptionFilter
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
      <NumberRangeFilter
        label="Added"
        min={filterState.addedDaysAgoGte}
        max={filterState.addedDaysAgoLte}
        onChangeMin={setAddedDaysAgoGte}
        onChangeMax={setAddedDaysAgoLte}
      />
      <NumberRangeFilter
        label="Size (GB)"
        min={filterState.sizeOnDiskGbGte}
        max={filterState.sizeOnDiskGbLte}
        onChangeMin={setSizeOnDiskGbGte}
        onChangeMax={setSizeOnDiskGbLte}
      />
      <NumberRangeFilter
        label="Sonarr Rating"
        min={filterState.sonarrRatingGte}
        max={filterState.sonarrRatingLte}
        onChangeMin={setSonarrRatingGte}
        onChangeMax={setSonarrRatingLte}
      />
      <OptionFilter
        label="Ended"
        options={SONARR_ENDED_OPTIONS}
        value={filterState.sonarrEnded}
        onChange={setSonarrEnded}
      />
      <NumberRangeFilter
        label="Last Aired"
        min={filterState.sonarrLastAiredDaysAgoGte}
        max={filterState.sonarrLastAiredDaysAgoLte}
        onChangeMin={setSonarrLastAiredDaysAgoGte}
        onChangeMax={setSonarrLastAiredDaysAgoLte}
      />
      <NumberRangeFilter
        label="% Episodes"
        min={filterState.sonarrPercentEpisodesGte}
        max={filterState.sonarrPercentEpisodesLte}
        onChangeMin={setSonarrPercentEpisodesGte}
        onChangeMax={setSonarrPercentEpisodesLte}
      />
    </FilterGroup>
  ) : null;

  const yearFilter = (
    <NumberRangeFilter
      label="Year"
      min={filterState.yearMin}
      max={filterState.yearMax}
      dataMin={dataMin}
      dataMax={dataMax}
      onChangeMin={setYearMin}
      onChangeMax={setYearMax}
    />
  );

  const playHistoryFilter = hasPlayHistorySection ? (
    <FilterGroup label="Play History">
      <OptionFilter
        options={TAUTULLI_WATCHED_OPTIONS}
        value={filterState.tautulliWatched}
        onChange={setTautulliWatched}
      />
      <NumberRangeFilter
        label="Last Watched"
        min={filterState.lastWatchedDaysAgoGte}
        max={filterState.lastWatchedDaysAgoLte}
        onChangeMin={setLastWatchedDaysAgoGte}
        onChangeMax={setLastWatchedDaysAgoLte}
      />
    </FilterGroup>
  ) : null;

  const overseerrFilter = hasOverseerrSection ? (
    <FilterGroup label="Requests">
      <OptionFilter
        options={OVERSEERR_HAS_ISSUE_OPTIONS}
        value={filterState.overseerrHasIssue}
        onChange={setOverseerrHasIssue}
      />
      <OptionFilter
        label="Status"
        options={OVERSEERR_REQUEST_STATUS_OPTIONS}
        value={filterState.overseerrRequestStatus}
        onChange={setOverseerrRequestStatus}
      />
    </FilterGroup>
  ) : null;

  const tmdbFilter = hasTmdbSection ? (
    <FilterGroup label="TMDB">
      <OptionFilter
        options={TMDB_STATUS_OPTIONS}
        value={filterState.tmdbStatus}
        onChange={setTmdbStatus}
      />
    </FilterGroup>
  ) : null;

  // ─── Active conditions — drives the saved-query summary row ───────────────
  // Each active filter becomes one removable chip. The chips are exactly the
  // conditions persisted by "Save as query", so the row makes the
  // filters → saved-query relationship literal.
  const fmtNum = (v: number | undefined) => (v != null ? String(v) : '…');
  const range = (lo: number | undefined, hi: number | undefined) => `${fmtNum(lo)}–${fmtNum(hi)}`;
  const optLabel = <T extends string>(
    opts: ReadonlyArray<{ value: T; label: string }>,
    v: string | undefined
  ): string | undefined => opts.find((o) => o.value === v)?.label;

  type Condition = { key: string; label: string; onClear: () => void };
  const activeConditions: Condition[] = [];
  const pushOpt = (key: string, label: string | undefined, onClear: () => void) => {
    if (label) activeConditions.push({ key, label, onClear });
  };

  if (filterState.title) {
    activeConditions.push({
      key: 'title',
      label: `“${filterState.title}”`,
      onClear: () => setTitle(''),
    });
  }
  // Movies
  pushOpt('hasFile', optLabel(HAS_FILE_OPTIONS, filterState.hasFile), () => setHasFile(undefined));
  if (movieTagIds.length > 0)
    activeConditions.push({
      key: 'movieTags',
      label: `Movie tags · ${movieTagIds.length}`,
      onClear: () => setMovieTagIds(undefined),
    });
  if (movieQualityProfileIds.length > 0)
    activeConditions.push({
      key: 'movieQuality',
      label: `Movie quality · ${movieQualityProfileIds.length}`,
      onClear: () => setMovieQualityProfileIds(undefined),
    });
  if (selectedMovieGenres.length > 0)
    activeConditions.push({
      key: 'movieGenres',
      label: `Movie genres · ${selectedMovieGenres.length}`,
      onClear: () => setMovieGenres(undefined),
    });
  if (filterState.radarrImdbRatingGte != null || filterState.radarrImdbRatingLte != null)
    activeConditions.push({
      key: 'imdb',
      label: `IMDB ${range(filterState.radarrImdbRatingGte, filterState.radarrImdbRatingLte)}`,
      onClear: () => {
        setRadarrImdbRatingGte(undefined);
        setRadarrImdbRatingLte(undefined);
      },
    });
  // Series
  pushOpt('monitored', optLabel(MONITORED_OPTIONS, filterState.monitored), () =>
    setMonitored(undefined)
  );
  pushOpt('seriesStatus', optLabel(SERIES_STATUS_OPTIONS, filterState.seriesStatus), () =>
    setSeriesStatus(undefined)
  );
  pushOpt('seriesType', optLabel(SERIES_TYPE_OPTIONS, filterState.seriesType), () =>
    setSeriesType(undefined)
  );
  if (seriesTagIds.length > 0)
    activeConditions.push({
      key: 'seriesTags',
      label: `Series tags · ${seriesTagIds.length}`,
      onClear: () => setSeriesTagIds(undefined),
    });
  if (seriesQualityProfileIds.length > 0)
    activeConditions.push({
      key: 'seriesQuality',
      label: `Series quality · ${seriesQualityProfileIds.length}`,
      onClear: () => setSeriesQualityProfileIds(undefined),
    });
  if (selectedSeriesGenres.length > 0)
    activeConditions.push({
      key: 'seriesGenres',
      label: `Series genres · ${selectedSeriesGenres.length}`,
      onClear: () => setSeriesGenres(undefined),
    });
  if (selectedNetworks.length > 0)
    activeConditions.push({
      key: 'network',
      label: `Network · ${selectedNetworks.length}`,
      onClear: () => setNetwork(undefined),
    });
  if (filterState.sonarrRatingGte != null || filterState.sonarrRatingLte != null)
    activeConditions.push({
      key: 'sonarrRating',
      label: `Rating ${range(filterState.sonarrRatingGte, filterState.sonarrRatingLte)}`,
      onClear: () => {
        setSonarrRatingGte(undefined);
        setSonarrRatingLte(undefined);
      },
    });
  pushOpt('sonarrEnded', optLabel(SONARR_ENDED_OPTIONS, filterState.sonarrEnded), () =>
    setSonarrEnded(undefined)
  );
  if (
    filterState.sonarrLastAiredDaysAgoGte != null ||
    filterState.sonarrLastAiredDaysAgoLte != null
  )
    activeConditions.push({
      key: 'lastAired',
      label: `Last aired ${range(filterState.sonarrLastAiredDaysAgoGte, filterState.sonarrLastAiredDaysAgoLte)}d`,
      onClear: () => {
        setSonarrLastAiredDaysAgoGte(undefined);
        setSonarrLastAiredDaysAgoLte(undefined);
      },
    });
  if (filterState.sonarrPercentEpisodesGte != null || filterState.sonarrPercentEpisodesLte != null)
    activeConditions.push({
      key: 'percentEpisodes',
      label: `Episodes ${range(filterState.sonarrPercentEpisodesGte, filterState.sonarrPercentEpisodesLte)}%`,
      onClear: () => {
        setSonarrPercentEpisodesGte(undefined);
        setSonarrPercentEpisodesLte(undefined);
      },
    });
  // Shared (movies + series)
  if (filterState.addedDaysAgoGte != null || filterState.addedDaysAgoLte != null)
    activeConditions.push({
      key: 'added',
      label: `Added ${range(filterState.addedDaysAgoGte, filterState.addedDaysAgoLte)}d`,
      onClear: () => {
        setAddedDaysAgoGte(undefined);
        setAddedDaysAgoLte(undefined);
      },
    });
  if (filterState.sizeOnDiskGbGte != null || filterState.sizeOnDiskGbLte != null)
    activeConditions.push({
      key: 'size',
      label: `Size ${range(filterState.sizeOnDiskGbGte, filterState.sizeOnDiskGbLte)} GB`,
      onClear: () => {
        setSizeOnDiskGbGte(undefined);
        setSizeOnDiskGbLte(undefined);
      },
    });
  // Year (library-global)
  if (filterState.yearMin != null || filterState.yearMax != null)
    activeConditions.push({
      key: 'year',
      label: `Year ${range(filterState.yearMin, filterState.yearMax)}`,
      onClear: () => {
        setYearMin(undefined);
        setYearMax(undefined);
      },
    });
  // Play History
  pushOpt('watched', optLabel(TAUTULLI_WATCHED_OPTIONS, filterState.tautulliWatched), () =>
    setTautulliWatched(undefined)
  );
  if (filterState.lastWatchedDaysAgoGte != null || filterState.lastWatchedDaysAgoLte != null)
    activeConditions.push({
      key: 'lastWatched',
      label: `Last watched ${range(filterState.lastWatchedDaysAgoGte, filterState.lastWatchedDaysAgoLte)}d`,
      onClear: () => {
        setLastWatchedDaysAgoGte(undefined);
        setLastWatchedDaysAgoLte(undefined);
      },
    });
  // Requests (Overseerr)
  pushOpt(
    'overseerrHasIssue',
    optLabel(OVERSEERR_HAS_ISSUE_OPTIONS, filterState.overseerrHasIssue),
    () => setOverseerrHasIssue(undefined)
  );
  pushOpt(
    'overseerrRequestStatus',
    optLabel(OVERSEERR_REQUEST_STATUS_OPTIONS, filterState.overseerrRequestStatus),
    () => setOverseerrRequestStatus(undefined)
  );
  // TMDB
  if (filterState.tmdbStatus)
    activeConditions.push({
      key: 'tmdbStatus',
      label: filterState.tmdbStatus,
      onClear: () => setTmdbStatus(undefined),
    });

  const conditionCount = activeConditions.length;

  const summaryRow = isActive ? (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border/60 pt-2">
      {conditionCount > 0 ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-hover whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-hover" aria-hidden="true" />
            Filtering by {conditionCount} {conditionCount === 1 ? 'condition' : 'conditions'}
          </span>
          <span className="h-3.5 w-px bg-border flex-shrink-0" aria-hidden="true" />
          <ul className="flex flex-wrap items-center gap-1.5 min-w-0" aria-label="Active filters">
            {activeConditions.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={c.onClear}
                  aria-label={`Remove filter: ${c.label}`}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 pl-2 pr-1.5 py-0.5 text-[11px] font-medium text-primary-hover hover:bg-primary/20 hover:border-primary/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {c.label}
                  <ChipX />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <span className="text-xs text-text-muted">Filters active</span>
      )}
      <div className="ml-auto flex items-center gap-3 flex-shrink-0 pl-2">
        {onSaveQuery && (
          <button
            type="button"
            onClick={onSaveQuery}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border border-primary/40 text-primary-hover hover:bg-primary/10 hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save as query
          </button>
        )}
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-text-muted hover:text-text-primary transition-colors underline underline-offset-2"
        >
          Clear all
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* ── Desktop filter bar (md+) ─────────────────────────────────────────── */}
      <div
        className="hidden md:block bg-surface-panel border-b border-border px-6 py-2.5"
        role="search"
        aria-label="Filter media library"
      >
        {/* Controls: search + year are library-global; each provider source is a
            labeled group so the bar reads as grouped clusters, not a wrapped sea. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          {searchInput}
          {yearFilter}
          {movieGroup}
          {seriesGroup}
          {playHistoryFilter}
          {overseerrFilter}
          {tmdbFilter}
        </div>
        {summaryRow}
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

            {/* Play History section */}
            {hasPlayHistorySection && (
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Play History</h3>
                <OptionFilter
                  variant="chips"
                  options={TAUTULLI_WATCHED_OPTIONS}
                  value={filterState.tautulliWatched}
                  onChange={setTautulliWatched}
                />
                <div className="mt-3">
                  <NumberRangeFilter
                    label="Last Watched"
                    min={filterState.lastWatchedDaysAgoGte}
                    max={filterState.lastWatchedDaysAgoLte}
                    onChangeMin={setLastWatchedDaysAgoGte}
                    onChangeMax={setLastWatchedDaysAgoLte}
                  />
                </div>
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
