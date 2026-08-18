import '@testing-library/jest-dom/vitest';
import type { ContentScope, FilterState, FilterValue } from '@app/hooks/useMediaFilters';
import type { MediaRuleDescriptor } from '@app/hooks/useMediaRules';
import { fireEvent, render, screen, setupUser, within } from '@tests/helpers/component';
import { describe, expect, it, vi } from 'vitest';
import { MediaFilterBar } from '../index';
import type { MediaFilterBarProps } from '../index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Mirrors MEDIA_RULES (server/modules/media/filterRegistry.ts). `rulesFor()` filters
// it the same way GET /api/filter-fields provider-gates its projection.
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
    sourceProviders: ['TAUTULLI', 'PLEX'],
    required: false,
  },
  {
    key: 'addedDaysAgo',
    label: 'Added',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: ['RADARR', 'SONARR'],
    required: false,
  },
  {
    key: 'sizeOnDiskGb',
    label: 'Size (GB)',
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
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'tagIds',
    label: 'Movie Tags',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'qualityProfileIds',
    label: 'Movie Quality',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'genres',
    label: 'Movie Genres',
    contentTypes: ['movie'],
    dataType: 'csv-strings',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'imdbRating',
    label: 'IMDB Rating',
    contentTypes: ['movie'],
    dataType: 'range',
    sourceProviders: ['RADARR'],
    required: false,
  },
  {
    key: 'studio',
    label: 'Movie Studio',
    contentTypes: ['movie'],
    dataType: 'csv-strings',
    sourceProviders: ['PLEX'],
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
    label: 'Status',
    contentTypes: ['show'],
    dataType: 'string',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'tagIds',
    label: 'Series Tags',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'qualityProfileIds',
    label: 'Series Quality',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'genres',
    label: 'Series Genres',
    contentTypes: ['show'],
    dataType: 'csv-strings',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'seriesType',
    label: 'Type',
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
    key: 'studio',
    label: 'Series Studio',
    contentTypes: ['show'],
    dataType: 'csv-strings',
    sourceProviders: ['PLEX'],
    required: false,
  },
  {
    key: 'communityRating',
    label: 'Sonarr Rating',
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
    label: 'Last Aired',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'episodePercentage',
    label: '% Episodes',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: ['SONARR'],
    required: false,
  },
  {
    key: 'tmdbStatus',
    label: 'TMDB Status',
    contentTypes: ['movie', 'show'],
    dataType: 'string',
    sourceProviders: ['TMDB'],
    required: false,
  },
  {
    key: 'overseerrRequestStatus',
    label: 'Status',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: ['OVERSEERR'],
    required: false,
  },
  {
    key: 'overseerrHasIssue',
    label: 'Has Issue',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: ['OVERSEERR'],
    required: false,
  },
  {
    key: 'lastWatchedDaysAgo',
    label: 'Last Watched',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: ['TAUTULLI', 'PLEX'],
    required: false,
  },
  {
    // csv-strings with no lookup source (matches filterRegistry.ts's real
    // shape) — RuleControl renders nothing for it. Regression coverage for
    // the picker offering a rule it can't actually render a control for.
    key: 'certification',
    label: 'Certification',
    contentTypes: ['movie', 'show'],
    dataType: 'csv-strings',
    sourceProviders: ['RADARR', 'SONARR', 'TMDB', 'OMDB'],
    required: false,
  },
];

function rulesFor(configuredTypes: Set<string>): MediaRuleDescriptor[] {
  return ALL_RULES.filter((rule) => rule.sourceProviders.some((sp) => configuredTypes.has(sp)));
}

const DEFAULT_VALUES: FilterState = {
  shared: { title: '' },
  movie: {},
  show: {},
  movieQualifiers: {},
  showQualifiers: {},
  movieSort: 'title_asc',
  seriesSort: 'title_asc',
};

const RICH_LOOKUPS: MediaFilterBarProps['lookups'] = {
  tags: {
    radarr: [
      { id: 1, label: '4K', providerId: 1, providerName: 'Radarr' },
      { id: 2, label: 'Remux', providerId: 1, providerName: 'Radarr' },
    ],
    sonarr: [
      { id: 1, label: 'Anime', providerId: 2, providerName: 'Sonarr' },
      { id: 2, label: 'Ongoing', providerId: 2, providerName: 'Sonarr' },
    ],
  },
  qualityProfiles: {
    radarr: [
      { id: 1, name: 'HD-1080p', providerId: 1, providerName: 'Radarr' },
      { id: 2, name: 'Any', providerId: 1, providerName: 'Radarr' },
    ],
    sonarr: [
      { id: 1, name: 'HD-1080p', providerId: 2, providerName: 'Sonarr' },
      { id: 2, name: 'Any', providerId: 2, providerName: 'Sonarr' },
    ],
  },
  genres: {
    movies: ['Action', 'Comedy', 'Drama'],
    series: ['Crime', 'Drama', 'Sci-Fi'],
  },
  networks: ['HBO', 'Netflix'],
  studio: ['Legendary Pictures', 'Warner Bros'],
};

const EMPTY_LOOKUPS: MediaFilterBarProps['lookups'] = {
  tags: { radarr: [], sonarr: [] },
  qualityProfiles: { radarr: [], sonarr: [] },
  genres: { movies: [], series: [] },
  networks: [],
  studio: [],
};

function makeProps(overrides: Partial<MediaFilterBarProps> = {}): MediaFilterBarProps {
  return {
    rules: rulesFor(new Set(['RADARR', 'SONARR', 'TAUTULLI'])),
    values: DEFAULT_VALUES,
    onRuleChange: vi.fn(),
    onQualifierChange: vi.fn(),
    clearAll: vi.fn(),
    isActive: false,
    movieYearRange: { min: 1990, max: 2024 },
    seriesYearRange: { min: 2000, max: 2024 },
    lookups: EMPTY_LOOKUPS,
    configuredTypes: new Set(['RADARR', 'SONARR', 'TAUTULLI']),
    mobileOpen: false,
    onMobileClose: vi.fn(),
    ...overrides,
  };
}

/** Builds `values` with one scoped field set, on top of `DEFAULT_VALUES`. */
function valuesWith(patch: {
  shared?: Record<string, FilterValue>;
  movie?: Record<string, FilterValue>;
  show?: Record<string, FilterValue>;
}): FilterState {
  return {
    ...DEFAULT_VALUES,
    shared: { ...DEFAULT_VALUES.shared, ...patch.shared },
    movie: { ...DEFAULT_VALUES.movie, ...patch.movie },
    show: { ...DEFAULT_VALUES.show, ...patch.show },
  };
}

function propsFor(configuredTypes: string[]): Partial<MediaFilterBarProps> {
  const types = new Set(configuredTypes);
  return { rules: rulesFor(types), configuredTypes: types };
}

/** Opens the "Add filter" picker and selects the rule with the given label —
 *  the add-filter pattern's controls only render once added (or already
 *  active), so most tests need this before asserting a control is present.
 *  The desktop bar's trigger stays mounted (just CSS-hidden) even when the
 *  mobile dialog is open, so mobile tests must pass `within(dialog)` to
 *  disambiguate the two "Add filter" triggers. */
async function addFilter(
  user: ReturnType<typeof setupUser>,
  label: string | RegExp,
  scope: Pick<typeof screen, 'getByRole'> = screen
) {
  await user.click(scope.getByRole('button', { name: /add filter/i }));
  await user.click(scope.getByRole('option', { name: label }));
}

// ─── Desktop bar — visibility ─────────────────────────────────────────────────

describe('MediaFilterBar — desktop bar renders', () => {
  it('renders the title search input', () => {
    render(<MediaFilterBar {...makeProps()} />);
    expect(screen.getByRole('searchbox', { name: /filter by title/i })).toBeInTheDocument();
  });

  it('renders a search landmark', () => {
    render(<MediaFilterBar {...makeProps()} />);
    expect(screen.getByRole('search', { name: /filter media library/i })).toBeInTheDocument();
  });

  it('does not show "Clear all" when isActive is false', () => {
    render(<MediaFilterBar {...makeProps({ isActive: false })} />);
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('shows "Clear all" button when isActive is true', () => {
    render(<MediaFilterBar {...makeProps({ isActive: true })} />);
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
  });
});

// ─── Provider gating ──────────────────────────────────────────────────────────

describe('MediaFilterBar — provider gating', () => {
  it('renders movie filters when RADARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS })} />);
    await addFilter(user, /has file/i);
    expect(screen.getByRole('button', { name: /downloaded/i })).toBeInTheDocument();
  });

  it('renders series filters when SONARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ ...propsFor(['SONARR']), lookups: EMPTY_LOOKUPS })} />);
    await addFilter(user, 'Monitored');
    expect(screen.getByRole('button', { name: 'Monitored' })).toBeInTheDocument();
  });

  it('renders tautulli watched filter when TAUTULLI is configured', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({ ...propsFor(['RADARR', 'TAUTULLI']), lookups: EMPTY_LOOKUPS })}
      />
    );
    await addFilter(user, 'Watched');
    expect(screen.getByRole('button', { name: 'Watched' })).toBeInTheDocument();
  });

  it('does not render movie filters when RADARR is not configured', () => {
    render(<MediaFilterBar {...makeProps({ ...propsFor(['SONARR']), lookups: EMPTY_LOOKUPS })} />);
    expect(screen.queryByRole('button', { name: /downloaded/i })).not.toBeInTheDocument();
  });

  it('does not render series filters when SONARR is not configured', () => {
    render(<MediaFilterBar {...makeProps({ ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS })} />);
    expect(screen.queryByRole('button', { name: /monitored/i })).not.toBeInTheDocument();
  });

  it('does not render tautulli filter when TAUTULLI is not configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({ ...propsFor(['RADARR', 'SONARR']), lookups: EMPTY_LOOKUPS })}
      />
    );
    expect(screen.queryByRole('button', { name: /watched/i })).not.toBeInTheDocument();
  });
});

// ─── activeTab gating ─────────────────────────────────────────────────────────

describe('MediaFilterBar — activeTab prop', () => {
  it('shows only movie filters when activeTab is movies', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          ...propsFor(['RADARR', 'SONARR']),
          activeTab: 'movies',
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    await addFilter(user, /has file/i);
    expect(screen.getByRole('button', { name: /downloaded/i })).toBeInTheDocument();
    // Series-only rules aren't even offered by the picker while on the movies tab.
    expect(screen.queryByRole('option', { name: 'Monitored' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /monitored/i })).not.toBeInTheDocument();
  });

  it('shows only series filters when activeTab is series', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          ...propsFor(['RADARR', 'SONARR']),
          activeTab: 'series',
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    await addFilter(user, 'Monitored');
    expect(screen.queryByRole('option', { name: /has file/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /downloaded/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Monitored' })).toBeInTheDocument();
  });
});

// ─── Multi-select dropdowns ───────────────────────────────────────────────────

describe('MediaFilterBar — MultiSelectDropdown', () => {
  it('renders movie tags dropdown when radarr tags are present', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await addFilter(user, /movie tags/i);
    expect(screen.getByRole('button', { name: /movie tags/i })).toBeInTheDocument();
  });

  it('renders series tags dropdown when sonarr tags are present', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await addFilter(user, /series tags/i);
    expect(screen.getByRole('button', { name: /series tags/i })).toBeInTheDocument();
  });

  it('renders movie genres dropdown when movie genres are present', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await addFilter(user, /movie genres/i);
    expect(screen.getByRole('button', { name: /movie genres/i })).toBeInTheDocument();
  });

  it('renders network dropdown when networks are present', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await addFilter(user, /network/i);
    expect(screen.getByRole('button', { name: /network/i })).toBeInTheDocument();
  });

  it('renders movie studio dropdown when studio options are present', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          lookups: RICH_LOOKUPS,
          rules: rulesFor(new Set(['RADARR', 'SONARR', 'TAUTULLI', 'PLEX'])),
          configuredTypes: new Set(['RADARR', 'SONARR', 'TAUTULLI', 'PLEX']),
        })}
      />
    );
    await addFilter(user, /movie studio/i);
    expect(screen.getByRole('button', { name: /movie studio/i })).toBeInTheDocument();
  });

  it('does not render movie tags dropdown when no radarr tags', () => {
    render(<MediaFilterBar {...makeProps({ lookups: EMPTY_LOOKUPS })} />);
    expect(screen.queryByRole('button', { name: /movie tags/i })).not.toBeInTheDocument();
  });

  it('opens the dropdown menu on click', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await addFilter(user, /movie tags/i);
    await user.click(screen.getByRole('button', { name: /movie tags/i }));
    expect(screen.getByRole('menu', { name: /movie tags/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /4k/i })).toBeInTheDocument();
  });

  it('closes the dropdown on Escape', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await addFilter(user, /movie tags/i);
    await user.click(screen.getByRole('button', { name: /movie tags/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: /movie tags/i })).not.toBeInTheDocument();
  });

  it('calls onRuleChange when a tag is selected', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS, onRuleChange })} />);
    await addFilter(user, /movie tags/i);
    await user.click(screen.getByRole('button', { name: /movie tags/i }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /4k/i }));
    expect(onRuleChange).toHaveBeenCalledWith('movie', 'tagIds', '1');
  });

  it('deselects a tag by clicking it again', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          lookups: RICH_LOOKUPS,
          onRuleChange,
          values: valuesWith({ movie: { tagIds: '1' } }),
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /movie tags, 1 selected/i }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /4k/i }));
    expect(onRuleChange).toHaveBeenCalledWith('movie', 'tagIds', undefined);
  });
});

// ─── Title search input ───────────────────────────────────────────────────────

describe('MediaFilterBar — title input', () => {
  it('shows the current title value', () => {
    render(
      <MediaFilterBar {...makeProps({ values: valuesWith({ shared: { title: 'batman' } }) })} />
    );
    expect(screen.getByRole('searchbox', { name: /filter by title/i })).toHaveValue('batman');
  });

  it('calls onRuleChange on input change', () => {
    const onRuleChange = vi.fn();
    render(<MediaFilterBar {...makeProps({ onRuleChange })} />);
    fireEvent.change(screen.getByRole('searchbox', { name: /filter by title/i }), {
      target: { value: 'matrix' },
    });
    expect(onRuleChange).toHaveBeenCalledWith('shared', 'title', 'matrix');
  });
});

// ─── Clear all ────────────────────────────────────────────────────────────────

describe('MediaFilterBar — clearAll', () => {
  it('calls clearAll when the button is clicked', async () => {
    const clearAll = vi.fn();
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ isActive: true, clearAll })} />);
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(clearAll).toHaveBeenCalledOnce();
  });
});

// ─── Active-conditions summary row ────────────────────────────────────────────

describe('MediaFilterBar — active conditions summary', () => {
  it('does not render the summary row when inactive', () => {
    render(<MediaFilterBar {...makeProps({ isActive: false })} />);
    expect(screen.queryByText(/filtering by/i)).not.toBeInTheDocument();
  });

  it('summarises active filters as a labelled count', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          isActive: true,
          values: valuesWith({ shared: { title: '', hasFile: 'true', year: { min: 2010 } } }),
        })}
      />
    );
    // hasFile=Downloaded + Year → 2 conditions
    expect(screen.getByText(/filtering by 2 conditions/i)).toBeInTheDocument();
  });

  it('uses the singular noun for a single condition', () => {
    render(
      <MediaFilterBar
        {...makeProps({ isActive: true, values: valuesWith({ shared: { hasFile: 'true' } }) })}
      />
    );
    expect(screen.getByText(/filtering by 1 condition$/i)).toBeInTheDocument();
  });

  it('renders a removable chip per active condition that clears just that filter', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          isActive: true,
          values: valuesWith({ shared: { title: '', hasFile: 'true', year: { min: 2010 } } }),
          onRuleChange,
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: /remove filter: downloaded/i }));
    expect(onRuleChange).toHaveBeenCalledWith('shared', 'hasFile', undefined);
    expect(onRuleChange).not.toHaveBeenCalledWith('shared', 'year', undefined);
  });

  it('clears both ends of a range filter from its chip', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          isActive: true,
          values: valuesWith({ shared: { title: '', year: { min: 2010, max: 2020 } } }),
          onRuleChange,
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: /remove filter: year/i }));
    expect(onRuleChange).toHaveBeenCalledWith('shared', 'year', undefined);
  });

  it('shows the Save as query action only when onSaveQuery is provided', () => {
    const onSaveQuery = vi.fn();
    const { rerender } = render(
      <MediaFilterBar
        {...makeProps({ isActive: true, values: valuesWith({ shared: { hasFile: 'true' } }) })}
      />
    );
    expect(screen.queryByRole('button', { name: /save as query/i })).not.toBeInTheDocument();

    rerender(
      <MediaFilterBar
        {...makeProps({
          isActive: true,
          values: valuesWith({ shared: { hasFile: 'true' } }),
          onSaveQuery,
        })}
      />
    );
    expect(screen.getByRole('button', { name: /save as query/i })).toBeInTheDocument();
  });
});

// ─── Mobile bottom sheet ──────────────────────────────────────────────────────

describe('MediaFilterBar — mobile sheet', () => {
  it('does not render the mobile dialog when mobileOpen is false', () => {
    render(<MediaFilterBar {...makeProps({ mobileOpen: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the mobile dialog when mobileOpen is true', () => {
    render(<MediaFilterBar {...makeProps({ mobileOpen: true })} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders Done button in mobile dialog', () => {
    render(<MediaFilterBar {...makeProps({ mobileOpen: true })} />);
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });

  it('calls onMobileClose when Done is clicked', async () => {
    const onMobileClose = vi.fn();
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ mobileOpen: true, onMobileClose })} />);
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(onMobileClose).toHaveBeenCalledOnce();
  });

  it('calls onMobileClose on Escape key', async () => {
    const onMobileClose = vi.fn();
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ mobileOpen: true, onMobileClose })} />);
    await user.keyboard('{Escape}');
    expect(onMobileClose).toHaveBeenCalledOnce();
  });

  it('shows Clear all in mobile dialog when isActive', () => {
    render(<MediaFilterBar {...makeProps({ mobileOpen: true, isActive: true })} />);
    expect(screen.getAllByRole('button', { name: /clear all/i }).length).toBeGreaterThan(0);
  });

  it('renders movie chips section in mobile dialog when RADARR configured', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({ mobileOpen: true, ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS })}
      />
    );
    await addFilter(user, /has file/i, within(screen.getByRole('dialog')));
    expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
  });

  it('renders series chips section in mobile dialog when SONARR configured', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({ mobileOpen: true, ...propsFor(['SONARR']), lookups: EMPTY_LOOKUPS })}
      />
    );
    await addFilter(user, 'Monitored', within(screen.getByRole('dialog')));
    expect(screen.getByRole('heading', { name: 'Series' })).toBeInTheDocument();
  });
});

// ─── OptionFilter integration ─────────────────────────────────────────────────

describe('MediaFilterBar — OptionFilter interactions', () => {
  it('calls onRuleChange when a movie file-status option is clicked', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({ ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS, onRuleChange })}
      />
    );
    await addFilter(user, /has file/i);
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(onRuleChange).toHaveBeenCalledWith('shared', 'hasFile', 'true');
  });

  it('clears hasFile when clicking the active option again', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          ...propsFor(['RADARR']),
          lookups: EMPTY_LOOKUPS,
          onRuleChange,
          values: valuesWith({ shared: { hasFile: 'true' } }),
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(onRuleChange).toHaveBeenCalledWith('shared', 'hasFile', undefined);
  });

  it('calls onRuleChange when a series status option is clicked', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({ ...propsFor(['SONARR']), lookups: EMPTY_LOOKUPS, onRuleChange })}
      />
    );
    await addFilter(user, 'Status');
    await user.click(screen.getByRole('button', { name: /continuing/i }));
    expect(onRuleChange).toHaveBeenCalledWith('show', 'seriesStatus', 'continuing');
  });

  it('calls onRuleChange when a watched option is clicked', async () => {
    const onRuleChange = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({ ...propsFor(['TAUTULLI']), lookups: EMPTY_LOOKUPS, onRuleChange })}
      />
    );
    await addFilter(user, 'Watched');
    await user.click(screen.getByRole('button', { name: /unwatched/i }));
    expect(onRuleChange).toHaveBeenCalledWith('shared', 'watched', 'false');
  });
});

// ─── Predicate controls ────────────────────────────────────────────────────────

describe('MediaFilterBar — movie predicate controls', () => {
  it('renders Added filter in movies section when RADARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps(propsFor(['RADARR']))} />);
    await addFilter(user, 'Added');
    expect(screen.getByRole('button', { name: /added/i })).toBeInTheDocument();
  });

  it('renders Size filter in movies section when RADARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps(propsFor(['RADARR']))} />);
    await addFilter(user, /size/i);
    expect(screen.getByRole('button', { name: /size/i })).toBeInTheDocument();
  });

  it('renders IMDB Rating filter in movies section when RADARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps(propsFor(['RADARR']))} />);
    await addFilter(user, /imdb rating/i);
    expect(screen.getByRole('button', { name: /imdb rating/i })).toBeInTheDocument();
  });

  it('does not render movie-specific filters when RADARR is not configured', () => {
    render(<MediaFilterBar {...makeProps(propsFor(['SONARR']))} />);
    expect(screen.queryByRole('button', { name: /imdb rating/i })).not.toBeInTheDocument();
  });
});

describe('MediaFilterBar — play history controls', () => {
  it('shows Watched filter when PLEX is configured (not just TAUTULLI)', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ ...propsFor(['PLEX']), lookups: EMPTY_LOOKUPS })} />);
    await addFilter(user, 'Watched');
    expect(screen.getByRole('button', { name: 'Watched' })).toBeInTheDocument();
  });

  it('shows Last Watched range filter when TAUTULLI is configured', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar {...makeProps({ ...propsFor(['TAUTULLI']), lookups: EMPTY_LOOKUPS })} />
    );
    await addFilter(user, /last watched/i);
    expect(screen.getByRole('button', { name: /last watched/i })).toBeInTheDocument();
  });

  it('shows Last Watched range filter when PLEX is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ ...propsFor(['PLEX']), lookups: EMPTY_LOOKUPS })} />);
    await addFilter(user, /last watched/i);
    expect(screen.getByRole('button', { name: /last watched/i })).toBeInTheDocument();
  });

  it('does not show play history controls when neither TAUTULLI nor PLEX configured', () => {
    render(<MediaFilterBar {...makeProps({ ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS })} />);
    expect(screen.queryByRole('button', { name: /last watched/i })).not.toBeInTheDocument();
  });
});

describe('MediaFilterBar — Overseerr controls', () => {
  it('shows Has Issue filter when OVERSEERR is configured', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar {...makeProps({ ...propsFor(['OVERSEERR']), lookups: EMPTY_LOOKUPS })} />
    );
    await addFilter(user, /has issue/i);
    expect(screen.getByRole('button', { name: /has issue/i })).toBeInTheDocument();
  });

  it('shows Request Status options (e.g. Approved) when OVERSEERR is configured', async () => {
    const user = setupUser();
    render(
      <MediaFilterBar {...makeProps({ ...propsFor(['OVERSEERR']), lookups: EMPTY_LOOKUPS })} />
    );
    await addFilter(user, 'Status');
    expect(screen.getByRole('button', { name: 'Approved' })).toBeInTheDocument();
  });

  it('does not show Overseerr controls when OVERSEERR is not configured', () => {
    render(<MediaFilterBar {...makeProps({ ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS })} />);
    expect(screen.queryByRole('button', { name: /has issue/i })).not.toBeInTheDocument();
  });
});

describe('MediaFilterBar — TMDB controls', () => {
  it('shows TMDB Status options (e.g. Returning Series) when TMDB is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ ...propsFor(['TMDB']), lookups: EMPTY_LOOKUPS })} />);
    await addFilter(user, /tmdb status/i);
    expect(screen.getByRole('button', { name: 'Returning Series' })).toBeInTheDocument();
  });

  it('does not show TMDB Status options when TMDB is not configured', () => {
    render(<MediaFilterBar {...makeProps({ ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS })} />);
    expect(screen.queryByRole('button', { name: 'Returning Series' })).not.toBeInTheDocument();
  });
});

describe('MediaFilterBar — series predicate controls', () => {
  it('renders Sonarr Rating filter in series section when SONARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps(propsFor(['SONARR']))} />);
    await addFilter(user, /sonarr rating/i);
    expect(screen.getByRole('button', { name: /sonarr rating/i })).toBeInTheDocument();
  });

  it('renders Ended filter in series section when SONARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps(propsFor(['SONARR']))} />);
    await addFilter(user, 'Ended');
    expect(screen.getByRole('button', { name: 'Finished' })).toBeInTheDocument();
  });

  it('renders Last Aired filter in series section when SONARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps(propsFor(['SONARR']))} />);
    await addFilter(user, /last aired/i);
    expect(screen.getByRole('button', { name: /last aired/i })).toBeInTheDocument();
  });

  it('renders % Episodes filter in series section when SONARR is configured', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps(propsFor(['SONARR']))} />);
    await addFilter(user, /% episodes/i);
    expect(screen.getByRole('button', { name: /% episodes/i })).toBeInTheDocument();
  });

  it('does not render series-specific filters when SONARR is not configured', () => {
    render(<MediaFilterBar {...makeProps(propsFor(['RADARR']))} />);
    expect(screen.queryByRole('button', { name: /sonarr rating/i })).not.toBeInTheDocument();
  });
});

// ─── FilterPicker — only offers renderable rules ──────────────────────────────

describe('MediaFilterBar — FilterPicker excludes unrenderable rules', () => {
  it('does not offer Certification — a csv-strings rule with no lookup source, which RuleControl renders as nothing', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ ...propsFor(['RADARR']), lookups: EMPTY_LOOKUPS })} />);
    await user.click(screen.getByRole('button', { name: /add filter/i }));
    expect(screen.queryByRole('option', { name: /certification/i })).not.toBeInTheDocument();
  });

  it('does not render an empty labeled group when a rule with no other visible fields would be the only content', () => {
    // Movies section would contain only Certification if offered — with no
    // renderable rule added, hasMovieSection must stay false so no empty
    // "Movies" panel appears.
    render(
      <MediaFilterBar
        {...makeProps({
          rules: [ALL_RULES.find((r) => r.key === 'certification')!],
          configuredTypes: new Set(['RADARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
  });
});
