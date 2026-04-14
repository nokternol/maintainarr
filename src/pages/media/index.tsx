import AppLayout from '@app/components/AppLayout';
import { MediaFilterBar } from '@app/components/MediaFilterBar';
import MediaCard from '@app/components/MediaCard';
import RatingsPanel from '@app/components/RatingsPanel';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import { VirtualMediaGrid } from '@app/components/VirtualMediaGrid';
import { useMediaFilters } from '@app/hooks/useMediaFilters';
import { useMediaLookups } from '@app/hooks/useMediaLookups';
import type { ManagedMovie } from '@app/hooks/useMovies';
import { useMovies } from '@app/hooks/useMovies';
import type { ManagedSeries } from '@app/hooks/useSeries';
import { useSeries } from '@app/hooks/useSeries';
import { useProviderSettings } from '@app/hooks/useProviderSettings';
import type { SidebarItem } from '@app/types/navigation';
import { cn } from '@app/lib/utils/cn';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

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

const MediaIcon = () => (
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
      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
    />
  </svg>
);

const SearchIcon = () => (
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
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
    />
  </svg>
);

const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard' },
  { id: 'media', label: 'Media', icon: <MediaIcon />, href: '/media', active: true },
  { id: 'search', label: 'Search', icon: <SearchIcon />, href: '/search' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPosterUrl(images?: { coverType: string; remoteUrl: string }[]): string | undefined {
  return images?.find((img) => img.coverType === 'poster')?.remoteUrl;
}

function countActiveFilters(filterState: {
  title: string;
  hasFile?: string;
  monitored?: string;
  seriesStatus?: string;
  yearMin?: number;
  yearMax?: number;
  movieTagIds?: string;
  seriesTagIds?: string;
  movieQualityProfileIds?: string;
  seriesQualityProfileIds?: string;
  movieGenres?: string;
  seriesGenres?: string;
  seriesType?: string;
  network?: string;
}): number {
  return [
    filterState.title ? 1 : 0,
    filterState.hasFile !== undefined ? 1 : 0,
    filterState.monitored !== undefined ? 1 : 0,
    filterState.seriesStatus !== undefined ? 1 : 0,
    filterState.yearMin !== undefined || filterState.yearMax !== undefined ? 1 : 0,
    filterState.movieTagIds ? 1 : 0,
    filterState.seriesTagIds ? 1 : 0,
    filterState.movieQualityProfileIds ? 1 : 0,
    filterState.seriesQualityProfileIds ? 1 : 0,
    filterState.movieGenres ? 1 : 0,
    filterState.seriesGenres ? 1 : 0,
    filterState.seriesType !== undefined ? 1 : 0,
    filterState.network ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

// ─── Infinite scroll sentinel ─────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SelectedMedia {
  title: string;
  year?: number;
}

type ActiveTab = 'movies' | 'series';

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
    clearAll,
    isActive,
  } = useMediaFilters();

  const movies = useMovies(debouncedFilters);
  const series = useSeries(debouncedFilters);
  const lookups = useMediaLookups();
  const { providers } = useProviderSettings();

  const configuredTypes = useMemo(
    () => new Set((providers ?? []).filter((p) => p.isActive).map((p) => p.type)),
    [providers]
  );

  const [selected, setSelected] = useState<SelectedMedia | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('movies');

  const movieSentinelRef = useSentinel(movies.fetchMore);
  const seriesSentinelRef = useSentinel(series.fetchMore);

  const nothingToShow =
    !movies.isLoading &&
    !series.isLoading &&
    movies.items.length === 0 &&
    series.items.length === 0;

  const activeFilterCount = countActiveFilters(filterState);

  // ─── Mobile bottom navigation ──────────────────────────────────────────────

  const mobileNav = (
    <nav className="flex items-center justify-around h-16 px-2">
      {sidebarItems.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={cn(
            'flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors min-h-[44px] justify-center',
            item.active
              ? 'text-primary'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );

  // ─── Shared filter props ───────────────────────────────────────────────────

  const filterBarProps = {
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
    clearAll,
    isActive,
    movieYearRange: movies.yearRange,
    seriesYearRange: series.yearRange,
    lookups,
    configuredTypes,
  };

  return (
    <AppLayout
      mobileNav={mobileNav}
      sidebar={
        <Sidebar
          items={sidebarItems}
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
        <div className="sticky top-0 z-10">
          <TopBar
            title="Managed Media"
            breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Media' }]}
            actions={
              // Mobile-only filter trigger — hidden on md+
              <button
                type="button"
                className={cn(
                  'md:hidden flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-primary text-text-primary border-primary'
                    : 'bg-transparent text-text-secondary border-border hover:bg-surface-hover'
                )}
                onClick={() => setFilterSheetOpen(true)}
              >
                <FilterIcon />
                Filters
                {isActive && (
                  <span className="bg-white/30 rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            }
          />
          {/* Desktop filter bar rendered here; mobile sheet is portal-like (fixed) */}
          <MediaFilterBar
            {...filterBarProps}
            mobileOpen={filterSheetOpen}
            onMobileClose={() => setFilterSheetOpen(false)}
          />

          {/* ── Movies / Series segment tabs — part of sticky header ─────────── */}
          <div className="flex items-center gap-1 px-3 sm:px-6 py-2 border-b border-border">
            {(['movies', 'series'] as const).map((tab) => {
              const count = tab === 'movies' ? movies.totalCount : series.totalCount;
              const loading = tab === 'movies' ? movies.isLoading : series.isLoading;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize',
                    activeTab === tab
                      ? 'bg-primary text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {!loading && (
                    <span className={cn('ml-1.5 text-xs', activeTab === tab ? 'opacity-80' : 'text-text-muted')}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      }
    >
      <div className="p-3 sm:p-6 space-y-6">

        {/* Movies section — always in DOM for tests, hidden when tab is series */}
        <section className={cn(activeTab !== 'movies' && 'hidden')}>
          <VirtualMediaGrid
            items={movies.items}
            isLoading={movies.isLoading}
            isFetchingMore={movies.isFetchingMore}
            renderItem={(movie: ManagedMovie) => (
              <button
                type="button"
                key={`movie-${movie.id}`}
                data-testid={`media-card-movie-${movie.id}`}
                className={cn(
                  'block w-full cursor-pointer bg-transparent border-0 p-0 text-left transition-transform active:scale-[0.97]',
                  selectedId !== null && selectedId !== `movie-${movie.id}` ? 'opacity-50' : ''
                )}
                onClick={() => {
                  setSelected({ title: movie.title, year: movie.year });
                  setSelectedId(`movie-${movie.id}`);
                }}
              >
                <MediaCard
                  id={`movie-${movie.id}`}
                  className={selectedId === `movie-${movie.id}` ? 'ring-2 ring-primary rounded-lg' : undefined}
                >
                  <MediaCard.Poster src={getPosterUrl(movie.images)} alt={movie.title} />
                  <MediaCard.Content>
                    <MediaCard.Title>{movie.title}</MediaCard.Title>
                    <MediaCard.Year>{movie.year}</MediaCard.Year>
                    <MediaCard.StatusBadge status={movie.hasFile ? 'downloaded' : 'missing'} />
                  </MediaCard.Content>
                </MediaCard>
              </button>
            )}
          />
          {movies.hasMore && !movies.isFetchingMore && <div ref={movieSentinelRef} style={{ height: 1 }} />}
        </section>

        {/* Series section — always in DOM for tests, hidden when tab is movies */}
        <section className={cn(activeTab !== 'series' && 'hidden')}>
          <VirtualMediaGrid
            items={series.items}
            isLoading={series.isLoading}
            isFetchingMore={series.isFetchingMore}
            renderItem={(show: ManagedSeries) => (
              <button
                type="button"
                key={`series-${show.id}`}
                data-testid={`media-card-series-${show.id}`}
                className={cn(
                  'block w-full cursor-pointer bg-transparent border-0 p-0 text-left transition-transform active:scale-[0.97]',
                  selectedId !== null && selectedId !== `series-${show.id}` ? 'opacity-50' : ''
                )}
                onClick={() => {
                  setSelected({ title: show.title, year: show.year });
                  setSelectedId(`series-${show.id}`);
                }}
              >
                <MediaCard
                  id={`series-${show.id}`}
                  className={selectedId === `series-${show.id}` ? 'ring-2 ring-primary rounded-lg' : undefined}
                >
                  <MediaCard.Poster src={getPosterUrl(show.images)} alt={show.title} />
                  <MediaCard.Content>
                    <MediaCard.Title>{show.title}</MediaCard.Title>
                    <MediaCard.Year>{show.year}</MediaCard.Year>
                    <MediaCard.StatusBadge status={show.monitored ? 'monitored' : undefined} />
                  </MediaCard.Content>
                </MediaCard>
              </button>
            )}
          />
          {series.hasMore && !series.isFetchingMore && <div ref={seriesSentinelRef} style={{ height: 1 }} />}
        </section>

        {nothingToShow && (
          <div className="text-text-secondary text-center py-16">
            No media found. Configure providers in Settings to scan your library.
          </div>
        )}
      </div>

      <RatingsPanel
        isOpen={selected !== null}
        onClose={() => {
          setSelected(null);
          setSelectedId(null);
        }}
        title={selected?.title ?? ''}
        year={selected?.year}
      />
    </AppLayout>
  );
}
