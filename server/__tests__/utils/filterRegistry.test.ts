import { describe, expect, it } from 'vitest';
import {
  FILTER_REGISTRY,
  type NormalizedMovie,
  type NormalizedShow,
  getFilterDef,
} from '../../utils/filterRegistry';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseMovie: NormalizedMovie = {
  _sourceIds: { radarr: 1 },
  title: 'Inception',
  year: 2010,
  hasFile: true,
  monitored: true,
  qualityProfileId: 1,
  tags: [10, 20],
  genres: ['Sci-Fi', 'Thriller'],
  addedDate: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  sizeOnDiskBytes: 5 * 1_073_741_824,
  certification: 'PG-13',
  imdbRating: 8.8,
  playCount: 3,
};

const baseShow: NormalizedShow = {
  _sourceIds: { sonarr: 1 },
  title: 'Breaking Bad',
  year: 2008,
  hasFile: true,
  monitored: false,
  qualityProfileId: 2,
  tags: [5, 15],
  genres: ['Drama', 'Crime'],
  addedDate: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  sizeOnDiskBytes: 20 * 1_073_741_824,
  certification: 'TV-MA',
  status: 'ended',
  ended: true,
  episodePercentage: 95,
  lastAiredAt: new Date(Date.now() - 100 * 86_400_000).toISOString(),
  communityRating: 9.5,
  seriesType: 'standard',
  network: 'AMC',
  playCount: 0,
};

// ─── Registry structure ───────────────────────────────────────────────────────

describe('FILTER_REGISTRY', () => {
  it('contains exactly 34 entries', () => {
    expect(FILTER_REGISTRY).toHaveLength(34);
  });

  it('every entry has required fields', () => {
    for (const def of FILTER_REGISTRY) {
      expect(def.key).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.contentTypes.length).toBeGreaterThan(0);
      expect(['boolean', 'number', 'string', 'csv-ids', 'csv-strings']).toContain(def.dataType);
      expect(def.sourceProviders.length).toBeGreaterThan(0);
      expect(typeof def.required).toBe('boolean');
      expect(typeof def.apply).toBe('function');
    }
  });
});

// ─── dataType classification ───────────────────────────────────────────────────
// The dataType is the contract the client reads to choose an input widget: `csv-ids`
// means numeric ids, `csv-strings` means free-text tokens. It must match what the
// predicate parses, otherwise the UI offers the wrong control.

describe('dataType classification', () => {
  it('genres compares strings — csv-strings, both content types', () => {
    expect(getFilterDef('genres', 'movie')!.dataType).toBe('csv-strings');
    expect(getFilterDef('genres', 'show')!.dataType).toBe('csv-strings');
  });

  it('certification compares strings — csv-strings', () => {
    expect(getFilterDef('certification', 'movie')!.dataType).toBe('csv-strings');
  });

  it('network compares strings — csv-strings', () => {
    expect(getFilterDef('network', 'show')!.dataType).toBe('csv-strings');
  });

  it('tagIds / qualityProfileIds compare numeric ids — csv-ids', () => {
    expect(getFilterDef('tagIds', 'movie')!.dataType).toBe('csv-ids');
    expect(getFilterDef('qualityProfileIds', 'movie')!.dataType).toBe('csv-ids');
  });
});

// ─── getFilterDef lookup ──────────────────────────────────────────────────────

describe('getFilterDef', () => {
  it('returns definition for (tagIds, movie)', () => {
    const def = getFilterDef('tagIds', 'movie');
    expect(def).toBeDefined();
    expect(def!.contentTypes).toContain('movie');
  });

  it('returns definition for (tagIds, show)', () => {
    const def = getFilterDef('tagIds', 'show');
    expect(def).toBeDefined();
    expect(def!.contentTypes).toContain('show');
  });

  it('returns undefined for unknown key', () => {
    expect(getFilterDef('nonexistent', 'movie')).toBeUndefined();
  });

  it('returns undefined when key exists but not for given contentType', () => {
    // imdbRatingGte is movie-only
    expect(getFilterDef('imdbRatingGte', 'show')).toBeUndefined();
  });
});

// ─── Movie predicates ────────────────────────────────────────────────────────

describe('movie predicates', () => {
  it('title — matches substring case-insensitively', () => {
    const def = getFilterDef('title', 'movie')!;
    expect(def.apply(baseMovie, 'inception')).toBe(true);
    expect(def.apply(baseMovie, 'INCEP')).toBe(true);
    expect(def.apply(baseMovie, 'Avatar')).toBe(false);
  });

  it('yearMin — passes when year >= value', () => {
    const def = getFilterDef('yearMin', 'movie')!;
    expect(def.apply(baseMovie, 2010)).toBe(true);
    expect(def.apply(baseMovie, 2011)).toBe(false);
    expect(def.apply({ ...baseMovie, year: undefined }, 2010)).toBe(false);
  });

  it('yearMax — passes when year <= value', () => {
    const def = getFilterDef('yearMax', 'movie')!;
    expect(def.apply(baseMovie, 2010)).toBe(true);
    expect(def.apply(baseMovie, 2009)).toBe(false);
  });

  it('hasFile — matches boolean exactly', () => {
    const def = getFilterDef('hasFile', 'movie')!;
    expect(def.apply(baseMovie, true)).toBe(true);
    expect(def.apply(baseMovie, false)).toBe(false);
  });

  it('tagIds — passes when item has any of the csv tag ids', () => {
    const def = getFilterDef('tagIds', 'movie')!;
    expect(def.apply(baseMovie, '10,30')).toBe(true);
    expect(def.apply(baseMovie, '99,100')).toBe(false);
  });

  it('qualityProfileIds — passes when item profile is in csv list', () => {
    const def = getFilterDef('qualityProfileIds', 'movie')!;
    expect(def.apply(baseMovie, '1,2')).toBe(true);
    expect(def.apply(baseMovie, '5,6')).toBe(false);
  });

  it('genres — passes when item has any of the csv genres', () => {
    const def = getFilterDef('genres', 'movie')!;
    expect(def.apply(baseMovie, 'Sci-Fi,Horror')).toBe(true);
    expect(def.apply(baseMovie, 'Romance')).toBe(false);
  });

  it('addedDaysAgoGte — passes when item was added at least N days ago', () => {
    const def = getFilterDef('addedDaysAgoGte', 'movie')!;
    expect(def.apply(baseMovie, 5)).toBe(true); // added 10 days ago, gte 5
    expect(def.apply(baseMovie, 15)).toBe(false); // added 10 days ago, gte 15
    expect(def.apply({ ...baseMovie, addedDate: undefined }, 5)).toBe(false);
  });

  it('addedDaysAgoLte — passes when item was added at most N days ago', () => {
    const def = getFilterDef('addedDaysAgoLte', 'movie')!;
    expect(def.apply(baseMovie, 15)).toBe(true); // added 10 days ago, lte 15
    expect(def.apply(baseMovie, 5)).toBe(false); // added 10 days ago, lte 5
  });

  it('sizeOnDiskGbGte — passes when size >= value GB', () => {
    const def = getFilterDef('sizeOnDiskGbGte', 'movie')!;
    expect(def.apply(baseMovie, 4)).toBe(true);
    expect(def.apply(baseMovie, 6)).toBe(false);
    expect(def.apply({ ...baseMovie, sizeOnDiskBytes: undefined }, 4)).toBe(false);
  });

  it('sizeOnDiskGbLte — passes when size <= value GB', () => {
    const def = getFilterDef('sizeOnDiskGbLte', 'movie')!;
    expect(def.apply(baseMovie, 6)).toBe(true);
    expect(def.apply(baseMovie, 4)).toBe(false);
  });

  it('certification — matches case-insensitively against csv list', () => {
    const def = getFilterDef('certification', 'movie')!;
    expect(def.apply(baseMovie, 'PG-13,R')).toBe(true);
    expect(def.apply(baseMovie, 'pg-13')).toBe(true);
    expect(def.apply(baseMovie, 'G')).toBe(false);
  });

  it('imdbRatingGte — passes when imdbRating >= value', () => {
    const def = getFilterDef('imdbRatingGte', 'movie')!;
    expect(def.apply(baseMovie, 8.0)).toBe(true);
    expect(def.apply(baseMovie, 9.0)).toBe(false);
    expect(def.apply({ ...baseMovie, imdbRating: undefined }, 8.0)).toBe(false);
  });

  it('imdbRatingLte — passes when imdbRating <= value', () => {
    const def = getFilterDef('imdbRatingLte', 'movie')!;
    expect(def.apply(baseMovie, 9.0)).toBe(true);
    expect(def.apply(baseMovie, 8.8)).toBe(true);
    expect(def.apply(baseMovie, 7.0)).toBe(false);
  });

  it('watched — passes when playCount > 0', () => {
    const def = getFilterDef('watched', 'movie')!;
    expect(def.apply(baseMovie, true)).toBe(true); // playCount=3
    expect(def.apply({ ...baseMovie, playCount: 0 }, true)).toBe(false);
    expect(def.apply(baseMovie, false)).toBe(false);
    expect(def.apply({ ...baseMovie, playCount: 0 }, false)).toBe(true);
  });
});

// ─── Show predicates ─────────────────────────────────────────────────────────

describe('show predicates', () => {
  it('title — show', () => {
    const def = getFilterDef('title', 'show')!;
    expect(def.apply(baseShow, 'breaking')).toBe(true);
    expect(def.apply(baseShow, 'Dexter')).toBe(false);
  });

  it('yearMin — show', () => {
    const def = getFilterDef('yearMin', 'show')!;
    expect(def.apply(baseShow, 2008)).toBe(true);
    expect(def.apply(baseShow, 2009)).toBe(false);
  });

  it('yearMax — show', () => {
    const def = getFilterDef('yearMax', 'show')!;
    expect(def.apply(baseShow, 2008)).toBe(true);
    expect(def.apply(baseShow, 2007)).toBe(false);
  });

  it('hasFile — show', () => {
    const def = getFilterDef('hasFile', 'show')!;
    expect(def.apply(baseShow, true)).toBe(true);
    expect(def.apply(baseShow, false)).toBe(false);
  });

  it('tagIds — show', () => {
    const def = getFilterDef('tagIds', 'show')!;
    expect(def.apply(baseShow, '5,99')).toBe(true);
    expect(def.apply(baseShow, '99')).toBe(false);
  });

  it('qualityProfileIds — show', () => {
    const def = getFilterDef('qualityProfileIds', 'show')!;
    expect(def.apply(baseShow, '2,3')).toBe(true);
    expect(def.apply(baseShow, '99')).toBe(false);
  });

  it('genres — show', () => {
    const def = getFilterDef('genres', 'show')!;
    expect(def.apply(baseShow, 'Drama,Comedy')).toBe(true);
    expect(def.apply(baseShow, 'Horror')).toBe(false);
  });

  it('monitored — show', () => {
    const def = getFilterDef('monitored', 'show')!;
    expect(def.apply(baseShow, false)).toBe(true);
    expect(def.apply(baseShow, true)).toBe(false);
  });

  it('seriesStatus — show', () => {
    const def = getFilterDef('seriesStatus', 'show')!;
    expect(def.apply(baseShow, 'ended')).toBe(true);
    expect(def.apply(baseShow, 'continuing')).toBe(false);
  });

  it('seriesType — show', () => {
    const def = getFilterDef('seriesType', 'show')!;
    expect(def.apply(baseShow, 'standard')).toBe(true);
    expect(def.apply(baseShow, 'anime')).toBe(false);
  });

  it('network — show, csv list', () => {
    const def = getFilterDef('network', 'show')!;
    expect(def.apply(baseShow, 'AMC,HBO')).toBe(true);
    expect(def.apply(baseShow, 'HBO')).toBe(false);
  });

  it('addedDaysAgoGte — show', () => {
    const def = getFilterDef('addedDaysAgoGte', 'show')!;
    expect(def.apply(baseShow, 10)).toBe(true); // added 20 days ago
    expect(def.apply(baseShow, 30)).toBe(false);
  });

  it('addedDaysAgoLte — show', () => {
    const def = getFilterDef('addedDaysAgoLte', 'show')!;
    expect(def.apply(baseShow, 30)).toBe(true);
    expect(def.apply(baseShow, 10)).toBe(false);
  });

  it('sizeOnDiskGbGte — show', () => {
    const def = getFilterDef('sizeOnDiskGbGte', 'show')!;
    expect(def.apply(baseShow, 15)).toBe(true);
    expect(def.apply(baseShow, 25)).toBe(false);
  });

  it('sizeOnDiskGbLte — show', () => {
    const def = getFilterDef('sizeOnDiskGbLte', 'show')!;
    expect(def.apply(baseShow, 25)).toBe(true);
    expect(def.apply(baseShow, 15)).toBe(false);
  });

  it('certification — show', () => {
    const def = getFilterDef('certification', 'show')!;
    expect(def.apply(baseShow, 'TV-MA')).toBe(true);
    expect(def.apply(baseShow, 'TV-PG')).toBe(false);
  });

  it('communityRatingGte — show', () => {
    const def = getFilterDef('communityRatingGte', 'show')!;
    expect(def.apply(baseShow, 9.0)).toBe(true);
    expect(def.apply(baseShow, 10.0)).toBe(false);
    expect(def.apply({ ...baseShow, communityRating: undefined }, 9.0)).toBe(false);
  });

  it('communityRatingLte — show', () => {
    const def = getFilterDef('communityRatingLte', 'show')!;
    expect(def.apply(baseShow, 10.0)).toBe(true);
    expect(def.apply(baseShow, 9.5)).toBe(true);
    expect(def.apply(baseShow, 8.0)).toBe(false);
  });

  it('ended — show', () => {
    const def = getFilterDef('ended', 'show')!;
    expect(def.apply(baseShow, true)).toBe(true);
    expect(def.apply(baseShow, false)).toBe(false);
  });

  it('lastAiredDaysAgoGte — show', () => {
    const def = getFilterDef('lastAiredDaysAgoGte', 'show')!;
    expect(def.apply(baseShow, 50)).toBe(true); // aired 100 days ago
    expect(def.apply(baseShow, 150)).toBe(false);
    expect(def.apply({ ...baseShow, lastAiredAt: undefined }, 50)).toBe(false);
  });

  it('lastAiredDaysAgoLte — show', () => {
    const def = getFilterDef('lastAiredDaysAgoLte', 'show')!;
    expect(def.apply(baseShow, 150)).toBe(true);
    expect(def.apply(baseShow, 50)).toBe(false);
  });

  it('episodePercentageGte — show', () => {
    const def = getFilterDef('episodePercentageGte', 'show')!;
    expect(def.apply(baseShow, 90)).toBe(true);
    expect(def.apply(baseShow, 100)).toBe(false);
    expect(def.apply({ ...baseShow, episodePercentage: undefined }, 90)).toBe(false);
  });

  it('episodePercentageLte — show', () => {
    const def = getFilterDef('episodePercentageLte', 'show')!;
    expect(def.apply(baseShow, 100)).toBe(true);
    expect(def.apply(baseShow, 95)).toBe(true);
    expect(def.apply(baseShow, 80)).toBe(false);
  });

  it('watched — show', () => {
    const def = getFilterDef('watched', 'show')!;
    expect(def.apply(baseShow, false)).toBe(true); // playCount=0
    expect(def.apply({ ...baseShow, playCount: 2 }, true)).toBe(true);
  });

  it('tmdbStatus — movie: true when tmdbStatus matches value', () => {
    const def = getFilterDef('tmdbStatus', 'movie')!;
    expect(def.apply({ ...baseMovie, tmdbStatus: 'Ended' }, 'Ended')).toBe(true);
    expect(def.apply({ ...baseMovie, tmdbStatus: 'In Production' }, 'Ended')).toBe(false);
    expect(def.apply({ ...baseMovie, tmdbStatus: undefined }, 'Ended')).toBe(false);
  });

  it('overseerrRequestStatus — movie: true when overseerrRequestStatus equals value', () => {
    const def = getFilterDef('overseerrRequestStatus', 'movie')!;
    expect(def.apply({ ...baseMovie, overseerrRequestStatus: 2 }, 2)).toBe(true);
    expect(def.apply({ ...baseMovie, overseerrRequestStatus: 1 }, 2)).toBe(false);
    expect(def.apply({ ...baseMovie, overseerrRequestStatus: undefined }, 2)).toBe(false);
  });

  it('overseerrHasIssue — movie: true when overseerrHasIssue matches value', () => {
    const def = getFilterDef('overseerrHasIssue', 'movie')!;
    expect(def.apply({ ...baseMovie, overseerrHasIssue: true }, true)).toBe(true);
    expect(def.apply({ ...baseMovie, overseerrHasIssue: false }, true)).toBe(false);
    expect(def.apply({ ...baseMovie, overseerrHasIssue: undefined }, true)).toBe(false);
  });

  it('overseerrHasIssue — movie: unknown (null/undefined) reads as "no issue" (truthy/falsy)', () => {
    const def = getFilterDef('overseerrHasIssue', 'movie')!;
    // Data stores truth (null = Overseerr said nothing); the filter treats unknown as falsy,
    // so "has issue = false" includes items with no reported issue.
    expect(def.apply({ ...baseMovie, overseerrHasIssue: undefined }, false)).toBe(true);
  });

  it('lastWatchedDaysAgoLte — movie: true when lastWatchedAt is at most N days ago', () => {
    const def = getFilterDef('lastWatchedDaysAgoLte', 'movie')!;
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(def.apply({ ...baseMovie, lastWatchedAt: twoDaysAgo }, 7)).toBe(true);
    expect(def.apply({ ...baseMovie, lastWatchedAt: tenDaysAgo }, 7)).toBe(false);
    expect(def.apply({ ...baseMovie, lastWatchedAt: undefined }, 7)).toBe(false);
  });

  it('lastWatchedDaysAgoGte — movie: true when lastWatchedAt is at least N days ago', () => {
    const def = getFilterDef('lastWatchedDaysAgoGte', 'movie')!;
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(def.apply({ ...baseMovie, lastWatchedAt: tenDaysAgo }, 7)).toBe(true);
    expect(def.apply({ ...baseMovie, lastWatchedAt: twoDaysAgo }, 7)).toBe(false);
    expect(def.apply({ ...baseMovie, lastWatchedAt: undefined }, 7)).toBe(false);
  });
});
