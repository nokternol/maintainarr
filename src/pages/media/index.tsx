import AppLayout from '@app/components/AppLayout';
import { MediaFilterBar } from '@app/components/MediaFilterBar';
import MediaCard from '@app/components/MediaCard';
import RatingsPanel from '@app/components/RatingsPanel';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import { VirtualMediaGrid } from '@app/components/VirtualMediaGrid';
import { useMediaFilters } from '@app/hooks/useMediaFilters';
import type { FilterState } from '@app/hooks/useMediaFilters';
import { useMediaLookups } from '@app/hooks/useMediaLookups';
import type { MediaQualityProfile, MediaTag } from '@app/hooks/useMediaLookups';
import type { ManagedMovie } from '@app/hooks/useMovies';
import { useMovies } from '@app/hooks/useMovies';
import type { ManagedSeries } from '@app/hooks/useSeries';
import { useSeries } from '@app/hooks/useSeries';
import { useProviderSettings } from '@app/hooks/useProviderSettings';
import type { SidebarItem } from '@app/types/navigation';
import { Tabs } from '@app/components/Tabs';
import { cn } from '@app/lib/utils/cn';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);

const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard' },
  { id: 'media', label: 'Media', icon: <MediaIcon />, href: '/media', active: true },
  { id: 'search', label: 'Search', icon: <SearchIcon />, href: '/search' },
];

// ─── Sort bar ─────────────────────────────────────────────────────────────────

type SortField = 'title' | 'year' | 'status';

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'status', label: 'Status' },
];

function parseSortValue(sort: string | undefined): { field: SortField; dir: 'asc' | 'desc' } {
  const s = sort ?? 'title_asc';
  const dir = s.endsWith('_desc') ? 'desc' : 'asc';
  const field = s.replace(/_(?:asc|desc)$/, '') as SortField;
  return { field, dir };
}

function SortFieldPicker({
  field,
  onChange,
  isNonDefault,
}: {
  field: SortField;
  onChange: (f: SortField) => void;
  isNonDefault: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = SORT_FIELDS.find((f) => f.value === field)?.label ?? 'Title';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Sort by"
        className={cn(
          'flex items-center gap-1 text-xs font-medium px-1.5 py-1 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
          isNonDefault ? 'text-primary hover:text-primary-hover' : 'text-text-secondary hover:text-text-primary'
        )}
      >
        {currentLabel}
        <svg className="w-3 h-3 opacity-50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Sort by"
          className="absolute top-full left-0 mt-1 bg-surface-elevated border border-border rounded-md shadow-lg py-1 z-20 min-w-[80px]"
        >
          {SORT_FIELDS.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={field === opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs transition-colors',
                  field === opt.value
                    ? 'text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-panel'
                )}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortBar({
  sortValue,
  onSortChange,
  count,
  tab,
  isLoading,
}: {
  sortValue: string;
  onSortChange: (v: string) => void;
  count: number;
  tab: ActiveTab;
  isLoading: boolean;
}) {
  const { field, dir } = parseSortValue(sortValue);
  const isNonDefault = sortValue !== 'title_asc';

  const handleFieldChange = (f: SortField) => onSortChange(`${f}_${dir}`);
  const handleDirToggle = () => onSortChange(`${field}_${dir === 'asc' ? 'desc' : 'asc'}`);

  return (
    <div
      role="toolbar"
      aria-label="Sort and result count"
      className="flex items-center justify-between px-4 sm:px-6 py-2 bg-surface-panel border-b border-border"
    >
      <div className="flex items-center gap-0.5">
        <span className="text-xs text-text-muted select-none mr-0.5">Sort:</span>
        <SortFieldPicker field={field} onChange={handleFieldChange} isNonDefault={isNonDefault} />
        <button
          type="button"
          onClick={handleDirToggle}
          aria-label={dir === 'asc' ? 'Sort ascending' : 'Sort descending'}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
            isNonDefault ? 'text-primary hover:text-primary-hover' : 'text-text-muted hover:text-text-secondary'
          )}
        >
          {dir === 'asc' ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true" className="flex items-center">
        {isLoading ? (
          <span className="inline-block h-3 w-16 rounded bg-surface-elevated animate-pulse" />
        ) : (
          <span className="text-xs text-text-muted tabular-nums">
            <span className="text-text-secondary font-medium">{count.toLocaleString()}</span>
            {' '}{tab === 'movies' ? 'movies' : 'series'}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPosterUrl(images?: { coverType: string; remoteUrl: string }[]): string | undefined {
  return images?.find((img) => img.coverType === 'poster')?.remoteUrl;
}

function countActiveFilters(filterState: FilterState, tab: ActiveTab): number {
  const shared =
    (filterState.title ? 1 : 0) +
    (filterState.yearMin !== undefined || filterState.yearMax !== undefined ? 1 : 0) +
    (filterState.tautulliWatched !== undefined ? 1 : 0);

  if (tab === 'movies') {
    return (
      shared +
      (filterState.hasFile !== undefined ? 1 : 0) +
      (filterState.movieTagIds ? 1 : 0) +
      (filterState.movieQualityProfileIds ? 1 : 0) +
      (filterState.movieGenres ? 1 : 0)
    );
  }
  return (
    shared +
    (filterState.monitored !== undefined ? 1 : 0) +
    (filterState.seriesStatus !== undefined ? 1 : 0) +
    (filterState.seriesTagIds ? 1 : 0) +
    (filterState.seriesQualityProfileIds ? 1 : 0) +
    (filterState.seriesGenres ? 1 : 0) +
    (filterState.seriesType !== undefined ? 1 : 0) +
    (filterState.network ? 1 : 0)
  );
}

function useSentinel(onIntersect: () => void) {
  const onIntersectRef = useRef(onIntersect);
  useEffect(() => { onIntersectRef.current = onIntersect; }, [onIntersect]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  return useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onIntersectRef.current(); },
      { rootMargin: '200px' }
    );
    observerRef.current.observe(el);
  }, []);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedMedia {
  title: string;
  year?: number;
}

export type ActiveTab = 'movies' | 'series';

export interface MediaSlice<T> {
  items: T[];
  totalCount: number;
  yearRange: { min: number | null; max: number | null } | null;
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  fetchMore: () => void;
}

interface Lookups {
  tags: { radarr: MediaTag[]; sonarr: MediaTag[] };
  qualityProfiles: { radarr: MediaQualityProfile[]; sonarr: MediaQualityProfile[] };
  genres: { movies: string[]; series: string[] };
  networks: string[];
}

export interface MediaContentProps {
  // filter bar
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
  activeFilterCount: number;
  // sort
  movieSort: string;
  seriesSort: string;
  setMovieSort: (v: string) => void;
  setSeriesSort: (v: string) => void;
  // tab
  activeTab: ActiveTab;
  // mobile filter overlay
  filtersOpen: boolean;
  onFiltersClose: () => void;
  // data
  movies: MediaSlice<ManagedMovie>;
  series: MediaSlice<ManagedSeries>;
  lookups: Lookups;
  configuredTypes: Set<string>;
  providersLoaded: boolean;
}

// ─── MediaContent ─────────────────────────────────────────────────────────────

export function MediaContent({
  filterState,
  setTitle, setHasFile, setMonitored, setSeriesStatus,
  setYearMin, setYearMax, setMovieTagIds, setSeriesTagIds,
  setMovieQualityProfileIds, setSeriesQualityProfileIds,
  setMovieGenres, setSeriesGenres, setSeriesType, setNetwork,
  setTautulliWatched, clearAll, isActive, activeFilterCount,
  movieSort, seriesSort, setMovieSort, setSeriesSort,
  activeTab, filtersOpen, onFiltersClose,
  movies, series, lookups, configuredTypes, providersLoaded,
}: MediaContentProps) {
  const [selected, setSelected] = useState<SelectedMedia | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const movieSentinelRef = useSentinel(movies.fetchMore);
  const seriesSentinelRef = useSentinel(series.fetchMore);

  return (
    <>
      <MediaFilterBar
        filterState={filterState}
        setTitle={setTitle}
        setHasFile={setHasFile}
        setMonitored={setMonitored}
        setSeriesStatus={setSeriesStatus}
        setYearMin={setYearMin}
        setYearMax={setYearMax}
        setMovieTagIds={setMovieTagIds}
        setSeriesTagIds={setSeriesTagIds}
        setMovieQualityProfileIds={setMovieQualityProfileIds}
        setSeriesQualityProfileIds={setSeriesQualityProfileIds}
        setMovieGenres={setMovieGenres}
        setSeriesGenres={setSeriesGenres}
        setSeriesType={setSeriesType}
        setNetwork={setNetwork}
        setTautulliWatched={setTautulliWatched}
        clearAll={clearAll}
        isActive={isActive}
        movieYearRange={movies.yearRange}
        seriesYearRange={series.yearRange}
        lookups={lookups}
        configuredTypes={configuredTypes}
        activeTab={activeTab}
        mobileOpen={filtersOpen}
        onMobileClose={onFiltersClose}
      />

      <SortBar
        sortValue={activeTab === 'movies' ? movieSort : seriesSort}
        onSortChange={activeTab === 'movies' ? setMovieSort : setSeriesSort}
        count={activeTab === 'movies' ? movies.totalCount : series.totalCount}
        tab={activeTab}
        isLoading={activeTab === 'movies' ? movies.isLoading : series.isLoading}
      />

      <div className="p-3 sm:p-6 space-y-6">
        {/* Movies section — always in DOM for tests, hidden when tab is series */}
        <section className={cn(activeTab !== 'movies' && 'hidden')}>
          <VirtualMediaGrid
            items={movies.items}
            isLoading={movies.isLoading}
            isFetchingMore={movies.isFetchingMore}
            renderItem={(movie: ManagedMovie) => (
              <MediaCard
                key={`movie-${movie.id}`}
                id={`movie-${movie.id}`}
                data-testid={`media-card-movie-${movie.id}`}
                className={selectedId === `movie-${movie.id}` ? 'ring-2 ring-primary rounded-lg' : undefined}
                onClick={(id) => {
                  setSelected({ title: movie.title, year: movie.year });
                  setSelectedId(id);
                }}
              >
                <MediaCard.Poster src={getPosterUrl(movie.images)} alt={movie.title} />
                <MediaCard.Content>
                  <MediaCard.Title>{movie.title}</MediaCard.Title>
                  <MediaCard.Year>{movie.year}</MediaCard.Year>
                  <MediaCard.StatusBadge status={movie.hasFile ? 'downloaded' : 'missing'} />
                </MediaCard.Content>
              </MediaCard>
            )}
          />
          {movies.hasMore && !movies.isFetchingMore && <div ref={movieSentinelRef} style={{ height: 1 }} />}
          {!movies.isLoading && movies.items.length === 0 && providersLoaded && (
            !configuredTypes.has('RADARR') ? (
              <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
                <p className="text-sm font-medium text-text-secondary">No Radarr connection configured.</p>
                <p className="text-xs text-text-muted">Add a Radarr provider in Settings to manage your movie library.</p>
                <a href="/settings" className="mt-2 text-xs text-primary hover:underline underline-offset-2">Go to Settings</a>
              </div>
            ) : activeFilterCount > 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
                <p className="text-sm text-text-secondary">No movies match your current filters.</p>
                <button type="button" onClick={clearAll} className="text-xs text-primary hover:underline underline-offset-2">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-1 text-center">
                <p className="text-sm text-text-secondary">Your movie library is empty.</p>
                <p className="text-xs text-text-muted">Movies synced from Radarr will appear here.</p>
              </div>
            )
          )}
        </section>

        {/* Series section — always in DOM for tests, hidden when tab is movies */}
        <section className={cn(activeTab !== 'series' && 'hidden')}>
          <VirtualMediaGrid
            items={series.items}
            isLoading={series.isLoading}
            isFetchingMore={series.isFetchingMore}
            renderItem={(show: ManagedSeries) => (
              <MediaCard
                key={`series-${show.id}`}
                id={`series-${show.id}`}
                data-testid={`media-card-series-${show.id}`}
                className={selectedId === `series-${show.id}` ? 'ring-2 ring-primary rounded-lg' : undefined}
                onClick={(id) => {
                  setSelected({ title: show.title, year: show.year });
                  setSelectedId(id);
                }}
              >
                <MediaCard.Poster src={getPosterUrl(show.images)} alt={show.title} />
                <MediaCard.Content>
                  <MediaCard.Title>{show.title}</MediaCard.Title>
                  <MediaCard.Year>{show.year}</MediaCard.Year>
                  <MediaCard.StatusBadge status={show.monitored ? 'monitored' : undefined} />
                </MediaCard.Content>
              </MediaCard>
            )}
          />
          {series.hasMore && !series.isFetchingMore && <div ref={seriesSentinelRef} style={{ height: 1 }} />}
          {!series.isLoading && series.items.length === 0 && providersLoaded && (
            !configuredTypes.has('SONARR') ? (
              <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
                <p className="text-sm font-medium text-text-secondary">No Sonarr connection configured.</p>
                <p className="text-xs text-text-muted">Add a Sonarr provider in Settings to manage your series library.</p>
                <a href="/settings" className="mt-2 text-xs text-primary hover:underline underline-offset-2">Go to Settings</a>
              </div>
            ) : activeFilterCount > 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
                <p className="text-sm text-text-secondary">No series match your current filters.</p>
                <button type="button" onClick={clearAll} className="text-xs text-primary hover:underline underline-offset-2">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-1 text-center">
                <p className="text-sm text-text-secondary">Your series library is empty.</p>
                <p className="text-xs text-text-muted">Series synced from Sonarr will appear here.</p>
              </div>
            )
          )}
        </section>
      </div>

      <RatingsPanel
        isOpen={selected !== null}
        onClose={() => { setSelected(null); setSelectedId(null); }}
        title={selected?.title ?? ''}
        year={selected?.year}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MediaPage() {
  const {
    filterState,
    debouncedFilters,
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
    setMovieSort,
    setSeriesSort,
    clearAll,
    isActive,
  } = useMediaFilters();

  const movies = useMovies({ ...debouncedFilters, sort: filterState.movieSort });
  const series = useSeries({ ...debouncedFilters, sort: filterState.seriesSort });
  const lookups = useMediaLookups();
  const { providers } = useProviderSettings();

  const configuredTypes = useMemo(
    () => new Set((providers ?? []).filter((p) => p.isActive).map((p) => p.type)),
    [providers]
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('movies');

  const providersLoaded = providers !== undefined;
  const activeFilterCount = countActiveFilters(filterState, activeTab);

  const mobileNav = (
    <nav className="flex items-center justify-around h-16 px-2">
      {sidebarItems.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={cn(
            'flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors min-h-[44px] justify-center',
            item.active ? 'text-primary' : 'text-text-muted hover:text-text-primary'
          )}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );

  return (
    <AppLayout
      mobileNav={mobileNav}
      sidebar={
        <Sidebar
          items={sidebarItems}
          logo={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">W</div>
              <span className="text-xl font-bold text-text-primary">Warden</span>
            </div>
          }
        />
      }
      topBar={
        <TopBar
          sticky
          title="Managed Media"
          breadcrumbs={[{ label: 'Home', href: '/' }]}
          actions={
            <>
              <Tabs
                tabs={[
                  { value: 'movies', label: 'Movies', count: movies.totalCount, loading: movies.isLoading },
                  { value: 'series', label: 'Series', count: series.totalCount, loading: series.isLoading },
                ]}
                active={activeTab}
                onChange={setActiveTab}
              />
              <button
                type="button"
                className={cn(
                  'md:hidden flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium border transition-colors',
                  isActive
                    ? 'bg-primary text-white border-primary'
                    : 'bg-transparent text-text-primary border-border hover:bg-surface-hover'
                )}
                onClick={() => setFiltersOpen(true)}
              >
                <FilterIcon />
                Filters
                {isActive && (
                  <span className="bg-white/30 rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </>
          }
        />
      }
    >
      <MediaContent
        filterState={filterState}
        setTitle={setTitle}
        setHasFile={setHasFile}
        setMonitored={setMonitored}
        setSeriesStatus={setSeriesStatus}
        setYearMin={setYearMin}
        setYearMax={setYearMax}
        setMovieTagIds={setMovieTagIds}
        setSeriesTagIds={setSeriesTagIds}
        setMovieQualityProfileIds={setMovieQualityProfileIds}
        setSeriesQualityProfileIds={setSeriesQualityProfileIds}
        setMovieGenres={setMovieGenres}
        setSeriesGenres={setSeriesGenres}
        setSeriesType={setSeriesType}
        setNetwork={setNetwork}
        setTautulliWatched={setTautulliWatched}
        clearAll={clearAll}
        isActive={isActive}
        activeFilterCount={activeFilterCount}
        movieSort={filterState.movieSort}
        seriesSort={filterState.seriesSort}
        setMovieSort={setMovieSort}
        setSeriesSort={setSeriesSort}
        activeTab={activeTab}
        filtersOpen={filtersOpen}
        onFiltersClose={() => setFiltersOpen(false)}
        movies={movies}
        series={series}
        lookups={lookups}
        configuredTypes={configuredTypes}
        providersLoaded={providersLoaded}
      />
    </AppLayout>
  );
}
