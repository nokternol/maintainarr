import type { ContentScope, FilterState, FilterValue } from '@app/hooks/useMediaFilters';
import type { MediaRuleDescriptor } from '@app/hooks/useMediaRules';
import type { Story } from '@ladle/react';
import { useState } from 'react';
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

// The full rule set, unfiltered — mirrors `MEDIA_RULES` (server/modules/media/filterRegistry.ts).
// `rulesFor()` below applies the same provider-gating `GET /api/filter-fields` does.
const ALL_RULES: MediaRuleDescriptor[] = [
  {
    key: 'title',
    label: 'Title',
    contentTypes: ['movie', 'show'],
    dataType: 'string',
    sourceProviders: ['RADARR', 'SONARR'],
    required: false,
  },
  {
    key: 'year',
    label: 'Year',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: ['RADARR', 'SONARR'],
    required: false,
  },
  {
    key: 'watched',
    label: 'Watched',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: ['TAUTULLI'],
    required: false,
  },
  {
    key: 'addedDaysAgo',
    label: 'Added (days ago)',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: ['RADARR', 'SONARR'],
    required: false,
  },
  {
    key: 'sizeOnDiskGb',
    label: 'Size on disk (GB)',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: ['RADARR', 'SONARR'],
    required: false,
  },
  {
    key: 'hasFile',
    label: 'Has file',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: ['RADARR', 'SONARR'],
    required: false,
  },
  {
    key: 'tagIds',
    label: 'Tags',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'qualityProfileIds',
    label: 'Quality profile',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'genres',
    label: 'Genres',
    contentTypes: ['movie'],
    dataType: 'csv-strings',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'imdbRating',
    label: 'IMDB rating',
    contentTypes: ['movie'],
    dataType: 'range',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'monitored',
    label: 'Monitored',
    contentTypes: ['show'],
    dataType: 'boolean',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'seriesStatus',
    label: 'Series status',
    contentTypes: ['show'],
    dataType: 'string',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'tagIds',
    label: 'Tags',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'qualityProfileIds',
    label: 'Quality profile',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'genres',
    label: 'Genres',
    contentTypes: ['show'],
    dataType: 'csv-strings',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'seriesType',
    label: 'Series type',
    contentTypes: ['show'],
    dataType: 'string',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'network',
    label: 'Network',
    contentTypes: ['show'],
    dataType: 'csv-strings',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'communityRating',
    label: 'Community rating',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'ended',
    label: 'Ended',
    contentTypes: ['show'],
    dataType: 'boolean',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'lastAiredDaysAgo',
    label: 'Last aired (days ago)',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'episodePercentage',
    label: 'Episode completion (%)',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'lastWatchedDaysAgo',
    label: 'Last watched (days ago)',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: ['TAUTULLI'],
    required: false,
  },
];

function rulesFor(configuredTypes: Set<string>): MediaRuleDescriptor[] {
  return ALL_RULES.filter((rule) => rule.sourceProviders.some((sp) => configuredTypes.has(sp)));
}

const EMPTY_FILTER_STATE: FilterState = {
  shared: { title: '' },
  movie: {},
  show: {},
  movieSort: 'title_asc',
  seriesSort: 'title_asc',
};

function isBucketActive(bucket: Record<string, FilterValue>, skipEmptyTitle = false): boolean {
  return Object.entries(bucket).some(([key, value]) => {
    if (skipEmptyTitle && key === 'title') return value !== '';
    if (value === undefined) return false;
    if (typeof value === 'object') return value.min !== undefined || value.max !== undefined;
    return true;
  });
}

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
  const [values, setValues] = useState<FilterState>(EMPTY_FILTER_STATE);
  const [mobileOpen, setMobileOpen] = useState(initialMobileOpen);

  const isActive =
    isBucketActive(values.shared, true) ||
    isBucketActive(values.movie) ||
    isBucketActive(values.show);

  const onRuleChange = (scope: ContentScope, key: string, value: FilterValue | undefined) =>
    setValues((s) => {
      const bucket = { ...s[scope] };
      if (value === undefined) delete bucket[key];
      else bucket[key] = value;
      return { ...s, [scope]: bucket };
    });

  const types =
    CONFIGURED_TYPE_OPTIONS[configuredTypes] ?? CONFIGURED_TYPE_OPTIONS['All providers'];
  const lookups = richLookups ? RICH_LOOKUPS : EMPTY_LOOKUPS;

  return (
    <div className="bg-surface-bg min-h-screen">
      <div className="px-6 py-2 bg-surface-elevated border-b border-border">
        <span className="text-xs text-text-muted font-mono">
          filter state:{' '}
          <span className={isActive ? 'text-primary' : 'text-text-muted'}>
            {isActive ? 'active' : 'default'}
          </span>
          {values.shared.title && (
            <span className="ml-2 text-text-secondary">title="{String(values.shared.title)}"</span>
          )}
        </span>
      </div>

      <MediaFilterBar
        rules={rulesFor(types)}
        values={values}
        onRuleChange={onRuleChange}
        clearAll={() => setValues(EMPTY_FILTER_STATE)}
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
  const [values, setValues] = useState<FilterState>({
    shared: { title: '', watched: 'false', year: { min: 2010 }, hasFile: 'true' },
    movie: {},
    show: { seriesStatus: 'continuing', seriesType: 'anime' },
    movieSort: 'title_asc',
    seriesSort: 'title_asc',
  });
  const onRuleChange = (scope: ContentScope, key: string, value: FilterValue | undefined) =>
    setValues((s) => {
      const bucket = { ...s[scope] };
      if (value === undefined) delete bucket[key];
      else bucket[key] = value;
      return { ...s, [scope]: bucket };
    });

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
        rules={ALL_RULES}
        values={values}
        onRuleChange={onRuleChange}
        clearAll={() => setValues(EMPTY_FILTER_STATE)}
        isActive={true}
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
