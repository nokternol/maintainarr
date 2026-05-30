import type { Story } from '@ladle/react';
import { useState } from 'react';
import type { FilterState } from '@app/hooks/useMediaFilters';
import { MediaFilterBar } from './index';

// ─── Mock data ────────────────────────────────────────────────────────────────

const TAGS = {
  radarr: [
    { id: 1, label: '4K' },
    { id: 2, label: 'Remux' },
    { id: 3, label: 'HDR' },
    { id: 4, label: 'BluRay' },
  ],
  sonarr: [
    { id: 1, label: 'Anime' },
    { id: 2, label: 'Ongoing' },
    { id: 3, label: 'Kids' },
  ],
};

const QUALITY_PROFILES = {
  radarr: [
    { id: 1, name: 'Ultra-HD' },
    { id: 2, name: 'HD-1080p' },
    { id: 3, name: 'SD' },
  ],
  sonarr: [
    { id: 1, name: 'Ultra-HD' },
    { id: 2, name: 'HD-720p/1080p' },
  ],
};

const GENRES = {
  movies: ['Action', 'Comedy', 'Crime', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Western'],
  series: ['Animation', 'Comedy', 'Crime', 'Drama', 'Reality', 'Sci-Fi', 'Talk'],
};

const NETWORKS = ['Netflix', 'HBO', 'Apple TV+', 'Disney+', 'Hulu', 'Prime Video', 'Peacock'];

const YEAR_RANGE = { min: 1980, max: 2024 };

const EMPTY_LOOKUPS = {
  tags: { radarr: [], sonarr: [] },
  qualityProfiles: { radarr: [], sonarr: [] },
  genres: { movies: [], series: [] },
  networks: [],
};

const RICH_LOOKUPS = {
  tags: TAGS,
  qualityProfiles: QUALITY_PROFILES,
  genres: GENRES,
  networks: NETWORKS,
};

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
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

const CONFIGURED_TYPE_OPTIONS = {
  'All providers': new Set(['RADARR', 'SONARR', 'TAUTULLI']),
  'Movies only (Radarr)': new Set(['RADARR']),
  'Series only (Sonarr)': new Set(['SONARR']),
  'Movies + Tautulli': new Set(['RADARR', 'TAUTULLI']),
  'Tautulli only': new Set(['TAUTULLI']),
};

type WrapperArgs = {
  configuredTypes: keyof typeof CONFIGURED_TYPE_OPTIONS;
  richLookups: boolean;
  mobileOpen: boolean;
};

function FilterBarWrapper({
  configuredTypes = 'All providers',
  richLookups = true,
  mobileOpen: initialMobileOpen = false,
}: WrapperArgs) {
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER);
  const [mobileOpen, setMobileOpen] = useState(initialMobileOpen);

  const isActive = Object.entries(filterState).some(([key, v]) =>
    key === 'title' ? v !== '' : v !== undefined,
  );

  const patch = (partial: Partial<FilterState>) =>
    setFilterState((s) => ({ ...s, ...partial }));

  const types = CONFIGURED_TYPE_OPTIONS[configuredTypes] ?? CONFIGURED_TYPE_OPTIONS['All providers'];
  const lookups = richLookups ? RICH_LOOKUPS : EMPTY_LOOKUPS;

  return (
    <div className="bg-surface-bg min-h-screen">
      <div className="px-6 py-2 bg-surface-elevated border-b border-border">
        <span className="text-xs text-text-muted font-mono">
          filter state:{' '}
          <span className={isActive ? 'text-primary' : 'text-text-muted'}>
            {isActive ? 'active' : 'default'}
          </span>
          {filterState.title && (
            <span className="ml-2 text-text-secondary">title="{filterState.title}"</span>
          )}
        </span>
      </div>

      <MediaFilterBar
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
        movieYearRange={YEAR_RANGE}
        seriesYearRange={YEAR_RANGE}
        lookups={lookups}
        configuredTypes={types}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
    </div>
  );
}

// ─── Shared argTypes ──────────────────────────────────────────────────────────

const sharedArgTypes = {
  configuredTypes: {
    control: { type: 'radio' as const },
    options: Object.keys(CONFIGURED_TYPE_OPTIONS),
    description: 'Which media providers are configured',
  },
  richLookups: {
    control: { type: 'boolean' as const },
    description: 'Populate tags, quality profiles, genres, and networks',
  },
  mobileOpen: {
    control: { type: 'boolean' as const },
    description: 'Open the mobile filter sheet',
  },
};

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Interactive: Story<WrapperArgs> = (args) => <FilterBarWrapper {...args} />;
Interactive.args = { configuredTypes: 'All providers', richLookups: true, mobileOpen: false };
Interactive.argTypes = sharedArgTypes;

export const MoviesOnly: Story<WrapperArgs> = (args) => <FilterBarWrapper {...args} />;
MoviesOnly.args = { configuredTypes: 'Movies only (Radarr)', richLookups: true, mobileOpen: false };
MoviesOnly.argTypes = sharedArgTypes;

export const SeriesOnly: Story<WrapperArgs> = (args) => <FilterBarWrapper {...args} />;
SeriesOnly.args = { configuredTypes: 'Series only (Sonarr)', richLookups: true, mobileOpen: false };
SeriesOnly.argTypes = sharedArgTypes;

export const NoLookups: Story<WrapperArgs> = (args) => <FilterBarWrapper {...args} />;
NoLookups.args = { configuredTypes: 'All providers', richLookups: false, mobileOpen: false };
NoLookups.argTypes = sharedArgTypes;

export const MobileSheet: Story<WrapperArgs> = (args) => <FilterBarWrapper {...args} />;
MobileSheet.args = { configuredTypes: 'All providers', richLookups: true, mobileOpen: true };
MobileSheet.argTypes = sharedArgTypes;

export const WithActiveFilters: Story = () => {
  const [filterState, setFilterState] = useState<FilterState>({
    ...DEFAULT_FILTER,
    hasFile: 'true',
    seriesStatus: 'continuing',
    seriesType: 'anime',
    tautulliWatched: 'false',
    yearMin: 2010,
  });
  const isActive = true;
  const patch = (partial: Partial<FilterState>) =>
    setFilterState((s) => ({ ...s, ...partial }));

  return (
    <div className="bg-surface-bg min-h-screen">
      <div className="px-6 py-2 bg-surface-elevated border-b border-border">
        <span className="text-xs text-text-muted font-mono">
          filter state: <span className="text-primary">active</span>
          <span className="ml-2 text-text-secondary">
            hasFile=true · seriesStatus=continuing · anime · unwatched · year≥2010
          </span>
        </span>
      </div>
      <MediaFilterBar
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
        movieYearRange={YEAR_RANGE}
        seriesYearRange={YEAR_RANGE}
        lookups={RICH_LOOKUPS}
        configuredTypes={new Set(['RADARR', 'SONARR', 'TAUTULLI'])}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    </div>
  );
};
