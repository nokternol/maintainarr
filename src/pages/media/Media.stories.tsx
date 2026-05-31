import type { FilterState } from '@app/hooks/useMediaFilters';
import type { ManagedMovie } from '@app/hooks/useMovies';
import type { ManagedSeries } from '@app/hooks/useSeries';
import type { Story } from '@ladle/react';
import { useState } from 'react';
import { MediaContent } from './index';
import type { ActiveTab, MediaSlice } from './index';

// ─── Fixture data ─────────────────────────────────────────────────────────────

const DEFAULT_FILTER: FilterState = {
  title: '',
  hasFile: undefined,
  monitored: undefined,
  seriesStatus: undefined,
  yearMin: undefined,
  yearMax: undefined,
  movieTagIds: undefined,
  seriesTagIds: undefined,
  movieQualityProfileIds: undefined,
  seriesQualityProfileIds: undefined,
  movieGenres: undefined,
  seriesGenres: undefined,
  seriesType: undefined,
  network: undefined,
  tautulliWatched: undefined,
  movieSort: 'title_asc',
  seriesSort: 'title_asc',
};

function emptySlice<T>(): MediaSlice<T> {
  return {
    items: [],
    totalCount: 0,
    yearRange: { min: 1980, max: 2024 },
    isLoading: false,
    isFetchingMore: false,
    hasMore: false,
    fetchMore: () => {},
  };
}

const LOOKUPS = {
  tags: {
    radarr: [
      { id: 1, label: '4K' },
      { id: 2, label: 'Remux' },
      { id: 3, label: 'HDR' },
    ],
    sonarr: [
      { id: 1, label: 'Anime' },
      { id: 2, label: 'Ongoing' },
    ],
  },
  qualityProfiles: {
    radarr: [
      { id: 1, name: 'Ultra-HD' },
      { id: 2, name: 'HD-1080p' },
    ],
    sonarr: [
      { id: 1, name: 'Ultra-HD' },
      { id: 2, name: 'HD-720p/1080p' },
    ],
  },
  genres: {
    movies: ['Action', 'Comedy', 'Crime', 'Drama', 'Horror', 'Sci-Fi', 'Thriller'],
    series: ['Animation', 'Comedy', 'Crime', 'Drama', 'Reality', 'Sci-Fi'],
  },
  networks: ['Netflix', 'HBO', 'Apple TV+', 'Disney+', 'Hulu'],
};

const ALL_PROVIDERS = new Set(['RADARR', 'SONARR', 'TAUTULLI']);

// ─── Controlled wrapper ───────────────────────────────────────────────────────

const SORT_KEYS = new Set(['movieSort', 'seriesSort']);

function Controlled({
  filtersOpen,
  onFiltersClose,
  activeTab = 'movies',
}: {
  filtersOpen: boolean;
  onFiltersClose: () => void;
  activeTab?: ActiveTab;
}) {
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER);
  const patch = (partial: Partial<FilterState>) => setFilterState((s) => ({ ...s, ...partial }));
  const isActive = Object.entries(filterState).some(([key, v]) => {
    if (SORT_KEYS.has(key)) return false;
    return key === 'title' ? v !== '' : v !== undefined;
  });

  return (
    <MediaContent
      filterState={filterState}
      setTitle={(v) => patch({ title: v })}
      setHasFile={(v) => patch({ hasFile: v })}
      setMonitored={(v) => patch({ monitored: v })}
      setSeriesStatus={(v) => patch({ seriesStatus: v })}
      setYearMin={(v) => patch({ yearMin: v })}
      setYearMax={(v) => patch({ yearMax: v })}
      setMovieTagIds={(v) => patch({ movieTagIds: v })}
      setSeriesTagIds={(v) => patch({ seriesTagIds: v })}
      setMovieQualityProfileIds={(v) => patch({ movieQualityProfileIds: v })}
      setSeriesQualityProfileIds={(v) => patch({ seriesQualityProfileIds: v })}
      setMovieGenres={(v) => patch({ movieGenres: v })}
      setSeriesGenres={(v) => patch({ seriesGenres: v })}
      setSeriesType={(v) => patch({ seriesType: v })}
      setNetwork={(v) => patch({ network: v })}
      setTautulliWatched={(v) => patch({ tautulliWatched: v })}
      clearAll={() => setFilterState(DEFAULT_FILTER)}
      isActive={isActive}
      activeFilterCount={0}
      movieSort={filterState.movieSort}
      seriesSort={filterState.seriesSort}
      setMovieSort={(v) => patch({ movieSort: v })}
      setSeriesSort={(v) => patch({ seriesSort: v })}
      activeTab={activeTab}
      filtersOpen={filtersOpen}
      onFiltersClose={onFiltersClose}
      movies={emptySlice<ManagedMovie>()}
      series={emptySlice<ManagedSeries>()}
      lookups={LOOKUPS}
      configuredTypes={ALL_PROVIDERS}
      providersLoaded={true}
      density="normal"
      onDensityChange={() => {}}
    />
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Mobile viewport, filters open. "Done" is intentionally non-functional — the story exists to show filter state. */
export const MobileFiltersOpen: Story = () => (
  <Controlled filtersOpen={true} onFiltersClose={() => {}} />
);
MobileFiltersOpen.meta = { width: 390 };

/** Mobile viewport, filters closed. Shows the empty library state at mobile width. */
export const Mobile: Story = () => <Controlled filtersOpen={false} onFiltersClose={() => {}} />;
Mobile.meta = { width: 390 };

/** Tablet viewport (md breakpoint). Desktop filter bar is visible; mobile filter controls are hidden. */
export const Tablet: Story = () => <Controlled filtersOpen={false} onFiltersClose={() => {}} />;
Tablet.meta = { width: 768 };
