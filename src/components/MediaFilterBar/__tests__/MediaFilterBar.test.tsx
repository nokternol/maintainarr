import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, setupUser } from '@tests/helpers/component';
import { describe, expect, it, vi } from 'vitest';
import { MediaFilterBar } from '../index';
import type { MediaFilterBarProps } from '../index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTER_STATE: MediaFilterBarProps['filterState'] = {
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
  addedDaysAgoGte: undefined,
  addedDaysAgoLte: undefined,
  sizeOnDiskGbGte: undefined,
  sizeOnDiskGbLte: undefined,
  certification: undefined,
  radarrImdbRatingGte: undefined,
  radarrImdbRatingLte: undefined,
  sonarrRatingGte: undefined,
  sonarrRatingLte: undefined,
  sonarrEnded: undefined,
  sonarrLastAiredDaysAgoGte: undefined,
  sonarrLastAiredDaysAgoLte: undefined,
  sonarrPercentEpisodesGte: undefined,
  sonarrPercentEpisodesLte: undefined,
};

const RICH_LOOKUPS: MediaFilterBarProps['lookups'] = {
  tags: {
    radarr: [
      { id: 1, label: '4K' },
      { id: 2, label: 'Remux' },
    ],
    sonarr: [
      { id: 1, label: 'Anime' },
      { id: 2, label: 'Ongoing' },
    ],
  },
  qualityProfiles: {
    radarr: [
      { id: 1, name: 'HD-1080p' },
      { id: 2, name: 'Any' },
    ],
    sonarr: [
      { id: 1, name: 'HD-1080p' },
      { id: 2, name: 'Any' },
    ],
  },
  genres: {
    movies: ['Action', 'Comedy', 'Drama'],
    series: ['Crime', 'Drama', 'Sci-Fi'],
  },
  networks: ['HBO', 'Netflix'],
};

const EMPTY_LOOKUPS: MediaFilterBarProps['lookups'] = {
  tags: { radarr: [], sonarr: [] },
  qualityProfiles: { radarr: [], sonarr: [] },
  genres: { movies: [], series: [] },
  networks: [],
};

function makeProps(overrides: Partial<MediaFilterBarProps> = {}): MediaFilterBarProps {
  return {
    filterState: DEFAULT_FILTER_STATE,
    setTitle: vi.fn(),
    setHasFile: vi.fn(),
    setMonitored: vi.fn(),
    setSeriesStatus: vi.fn(),
    setYearMin: vi.fn(),
    setYearMax: vi.fn(),
    setMovieTagIds: vi.fn(),
    setSeriesTagIds: vi.fn(),
    setMovieQualityProfileIds: vi.fn(),
    setSeriesQualityProfileIds: vi.fn(),
    setMovieGenres: vi.fn(),
    setSeriesGenres: vi.fn(),
    setSeriesType: vi.fn(),
    setNetwork: vi.fn(),
    setTautulliWatched: vi.fn(),
    setAddedDaysAgoGte: vi.fn(),
    setAddedDaysAgoLte: vi.fn(),
    setSizeOnDiskGbGte: vi.fn(),
    setSizeOnDiskGbLte: vi.fn(),
    setCertification: vi.fn(),
    setRadarrImdbRatingGte: vi.fn(),
    setRadarrImdbRatingLte: vi.fn(),
    setSonarrRatingGte: vi.fn(),
    setSonarrRatingLte: vi.fn(),
    setSonarrEnded: vi.fn(),
    setSonarrLastAiredDaysAgoGte: vi.fn(),
    setSonarrLastAiredDaysAgoLte: vi.fn(),
    setSonarrPercentEpisodesGte: vi.fn(),
    setSonarrPercentEpisodesLte: vi.fn(),
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
  it('renders movie filters when RADARR is configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.getByRole('button', { name: /downloaded/i })).toBeInTheDocument();
  });

  it('renders series filters when SONARR is configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['SONARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    // "Monitored" and "Unmonitored" are both present; check the exact label
    expect(screen.getByRole('button', { name: 'Monitored' })).toBeInTheDocument();
  });

  it('renders tautulli watched filter when TAUTULLI is configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR', 'TAUTULLI']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    // "Watched" and "Unwatched" are both present; check the exact label
    expect(screen.getByRole('button', { name: 'Watched' })).toBeInTheDocument();
  });

  it('does not render movie filters when RADARR is not configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['SONARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.queryByRole('button', { name: /downloaded/i })).not.toBeInTheDocument();
  });

  it('does not render series filters when SONARR is not configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.queryByRole('button', { name: /monitored/i })).not.toBeInTheDocument();
  });

  it('does not render tautulli filter when TAUTULLI is not configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR', 'SONARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.queryByRole('button', { name: /watched/i })).not.toBeInTheDocument();
  });
});

// ─── activeTab gating ─────────────────────────────────────────────────────────

describe('MediaFilterBar — activeTab prop', () => {
  it('shows only movie filters when activeTab is movies', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR', 'SONARR']),
          activeTab: 'movies',
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.getByRole('button', { name: /downloaded/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /monitored/i })).not.toBeInTheDocument();
  });

  it('shows only series filters when activeTab is series', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR', 'SONARR']),
          activeTab: 'series',
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.queryByRole('button', { name: /downloaded/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Monitored' })).toBeInTheDocument();
  });
});

// ─── Multi-select dropdowns ───────────────────────────────────────────────────

describe('MediaFilterBar — MultiSelectDropdown', () => {
  it('renders movie tags dropdown when radarr tags are present', () => {
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    expect(screen.getByRole('button', { name: /movie tags/i })).toBeInTheDocument();
  });

  it('renders series tags dropdown when sonarr tags are present', () => {
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    expect(screen.getByRole('button', { name: /series tags/i })).toBeInTheDocument();
  });

  it('renders movie genres dropdown when movie genres are present', () => {
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    expect(screen.getByRole('button', { name: /movie genres/i })).toBeInTheDocument();
  });

  it('renders network dropdown when networks are present', () => {
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    expect(screen.getByRole('button', { name: /network/i })).toBeInTheDocument();
  });

  it('does not render movie tags dropdown when no radarr tags', () => {
    render(<MediaFilterBar {...makeProps({ lookups: EMPTY_LOOKUPS })} />);
    expect(screen.queryByRole('button', { name: /movie tags/i })).not.toBeInTheDocument();
  });

  it('opens the dropdown menu on click', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await user.click(screen.getByRole('button', { name: /movie tags/i }));
    expect(screen.getByRole('menu', { name: /movie tags/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /4k/i })).toBeInTheDocument();
  });

  it('closes the dropdown on Escape', async () => {
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS })} />);
    await user.click(screen.getByRole('button', { name: /movie tags/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: /movie tags/i })).not.toBeInTheDocument();
  });

  it('calls setMovieTagIds when a tag is selected', async () => {
    const setMovieTagIds = vi.fn();
    const user = setupUser();
    render(<MediaFilterBar {...makeProps({ lookups: RICH_LOOKUPS, setMovieTagIds })} />);
    await user.click(screen.getByRole('button', { name: /movie tags/i }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /4k/i }));
    expect(setMovieTagIds).toHaveBeenCalledWith('1');
  });

  it('deselects a tag by clicking it again', async () => {
    const setMovieTagIds = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          lookups: RICH_LOOKUPS,
          setMovieTagIds,
          filterState: { ...DEFAULT_FILTER_STATE, movieTagIds: '1' },
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /movie tags, 1 selected/i }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /4k/i }));
    expect(setMovieTagIds).toHaveBeenCalledWith(undefined);
  });
});

// ─── Title search input ───────────────────────────────────────────────────────

describe('MediaFilterBar — title input', () => {
  it('shows the current title value', () => {
    render(
      <MediaFilterBar
        {...makeProps({ filterState: { ...DEFAULT_FILTER_STATE, title: 'batman' } })}
      />
    );
    expect(screen.getByRole('searchbox', { name: /filter by title/i })).toHaveValue('batman');
  });

  it('calls setTitle on input change', () => {
    const setTitle = vi.fn();
    render(<MediaFilterBar {...makeProps({ setTitle })} />);
    // fireEvent.change fires a single change event with the full value
    fireEvent.change(screen.getByRole('searchbox', { name: /filter by title/i }), {
      target: { value: 'matrix' },
    });
    expect(setTitle).toHaveBeenCalledWith('matrix');
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

  it('renders movie chips section in mobile dialog when RADARR configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          mobileOpen: true,
          configuredTypes: new Set(['RADARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    // Mobile dialog uses <h3> headings for sections
    expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
  });

  it('renders series chips section in mobile dialog when SONARR configured', () => {
    render(
      <MediaFilterBar
        {...makeProps({
          mobileOpen: true,
          configuredTypes: new Set(['SONARR']),
          lookups: EMPTY_LOOKUPS,
        })}
      />
    );
    expect(screen.getByRole('heading', { name: 'Series' })).toBeInTheDocument();
  });
});

// ─── OptionFilter integration ─────────────────────────────────────────────────

describe('MediaFilterBar — OptionFilter interactions', () => {
  it('calls setHasFile when a movie file-status option is clicked', async () => {
    const setHasFile = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR']),
          lookups: EMPTY_LOOKUPS,
          setHasFile,
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(setHasFile).toHaveBeenCalledWith('true');
  });

  it('clears hasFile when clicking the active option again', async () => {
    const setHasFile = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['RADARR']),
          lookups: EMPTY_LOOKUPS,
          setHasFile,
          filterState: { ...DEFAULT_FILTER_STATE, hasFile: 'true' },
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(setHasFile).toHaveBeenCalledWith(undefined);
  });

  it('calls setSeriesStatus when a status option is clicked', async () => {
    const setSeriesStatus = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['SONARR']),
          lookups: EMPTY_LOOKUPS,
          setSeriesStatus,
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /continuing/i }));
    expect(setSeriesStatus).toHaveBeenCalledWith('continuing');
  });

  it('calls setTautulliWatched when a watched option is clicked', async () => {
    const setTautulliWatched = vi.fn();
    const user = setupUser();
    render(
      <MediaFilterBar
        {...makeProps({
          configuredTypes: new Set(['TAUTULLI']),
          lookups: EMPTY_LOOKUPS,
          setTautulliWatched,
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /unwatched/i }));
    expect(setTautulliWatched).toHaveBeenCalledWith('false');
  });
});

// ─── Phase 1 predicate controls ───────────────────────────────────────────────

describe('MediaFilterBar — Phase 1 movie predicate controls', () => {
  it('renders Added filter in movies section when RADARR is configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['RADARR']) })} />);
    expect(screen.getByRole('button', { name: /added/i })).toBeInTheDocument();
  });

  it('renders Size filter in movies section when RADARR is configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['RADARR']) })} />);
    expect(screen.getByRole('button', { name: /size/i })).toBeInTheDocument();
  });

  it('renders IMDB Rating filter in movies section when RADARR is configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['RADARR']) })} />);
    expect(screen.getByRole('button', { name: /imdb rating/i })).toBeInTheDocument();
  });

  it('does not render movie-specific Phase 1 filters when RADARR is not configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['SONARR']) })} />);
    expect(screen.queryByRole('button', { name: /imdb rating/i })).not.toBeInTheDocument();
  });
});

describe('MediaFilterBar — Phase 1 series predicate controls', () => {
  it('renders Sonarr Rating filter in series section when SONARR is configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['SONARR']) })} />);
    expect(screen.getByRole('button', { name: /sonarr rating/i })).toBeInTheDocument();
  });

  it('renders Ended filter in series section when SONARR is configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['SONARR']) })} />);
    expect(screen.getByRole('button', { name: 'Finished' })).toBeInTheDocument();
  });

  it('renders Last Aired filter in series section when SONARR is configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['SONARR']) })} />);
    expect(screen.getByRole('button', { name: /last aired/i })).toBeInTheDocument();
  });

  it('renders % Episodes filter in series section when SONARR is configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['SONARR']) })} />);
    expect(screen.getByRole('button', { name: /% episodes/i })).toBeInTheDocument();
  });

  it('does not render series-specific Phase 1 filters when SONARR is not configured', () => {
    render(<MediaFilterBar {...makeProps({ configuredTypes: new Set(['RADARR']) })} />);
    expect(screen.queryByRole('button', { name: /sonarr rating/i })).not.toBeInTheDocument();
  });
});
