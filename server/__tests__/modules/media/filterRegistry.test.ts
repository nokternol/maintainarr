import { MetadataProviderType } from '@server/database/schema';
import {
  MEDIA_RULES,
  type NormalizedMovie,
  type NormalizedShow,
  deriveSourceProviders,
  getRule,
} from '@server/modules/media/filterRegistry';
import { describe, expect, it } from 'vitest';

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
  plexAddedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
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
  seriesStatus: 'ended',
  ended: true,
  episodePercentage: 95,
  lastAiredAt: new Date(Date.now() - 100 * 86_400_000).toISOString(),
  communityRating: 9.5,
  seriesType: 'standard',
  network: 'AMC',
  playCount: 0,
};

// ─── Registry structure ───────────────────────────────────────────────────────

describe('MEDIA_RULES', () => {
  it('contains exactly 27 entries', () => {
    expect(MEDIA_RULES).toHaveLength(27);
  });

  it('every entry has required fields', () => {
    for (const rule of MEDIA_RULES) {
      expect(rule.key).toBeTruthy();
      expect(rule.label).toBeTruthy();
      expect(rule.contentTypes.length).toBeGreaterThan(0);
      expect(['boolean', 'number', 'string', 'csv-ids', 'csv-strings', 'range']).toContain(
        rule.dataType
      );
      expect(rule.sourceProviders.length).toBeGreaterThan(0);
      expect(typeof rule.required).toBe('boolean');
      expect(typeof rule.predicate).toBe('function');
    }
  });
});

// ─── dataType classification ───────────────────────────────────────────────────
// The dataType is the contract the client reads to choose an input widget: `csv-ids`
// means numeric ids, `csv-strings` means free-text tokens. It must match what the
// predicate parses, otherwise the UI offers the wrong control.

describe('dataType classification', () => {
  it('genres compares strings — csv-strings, both content types', () => {
    expect(getRule('genres', 'movie')!.dataType).toBe('csv-strings');
    expect(getRule('genres', 'show')!.dataType).toBe('csv-strings');
  });

  it('certification compares strings — csv-strings', () => {
    expect(getRule('certification', 'movie')!.dataType).toBe('csv-strings');
  });

  it('network compares strings — csv-strings', () => {
    expect(getRule('network', 'show')!.dataType).toBe('csv-strings');
  });

  it('tagIds / qualityProfileIds compare numeric ids — csv-ids', () => {
    expect(getRule('tagIds', 'movie')!.dataType).toBe('csv-ids');
    expect(getRule('qualityProfileIds', 'movie')!.dataType).toBe('csv-ids');
  });

  it('year / addedDaysAgo / imdbRating are bounded — range', () => {
    expect(getRule('year', 'movie')!.dataType).toBe('range');
    expect(getRule('addedDaysAgo', 'movie')!.dataType).toBe('range');
    expect(getRule('imdbRating', 'movie')!.dataType).toBe('range');
  });
});

// ─── sourceProviders accuracy ───────────────────────────────────────────────
// sourceProviders must reflect the real owner of a field, confirmed against
// docs/architecture/media-providers.md — a stale entry implies an integration
// that doesn't exist in this deployment.

describe('sourceProviders accuracy', () => {
  it('tagIds (movie) lists only Radarr — Sonarr cannot produce a movie tag', () => {
    expect(getRule('tagIds', 'movie')!.sourceProviders).toEqual([MetadataProviderType.RADARR]);
  });

  it('tagIds (show) lists only Sonarr — Radarr cannot produce a show tag', () => {
    expect(getRule('tagIds', 'show')!.sourceProviders).toEqual([MetadataProviderType.SONARR]);
  });

  it('watched is derived from playCount — Tautulli before Plex, matching the field it reads', () => {
    expect(getRule('watched', 'movie')!.sourceProviders).toEqual([
      MetadataProviderType.TAUTULLI,
      MetadataProviderType.PLEX,
    ]);
  });

  it('genres (movie) is Radarr-only — no TMDB genres call is wired', () => {
    expect(getRule('genres', 'movie')!.sourceProviders).toEqual([MetadataProviderType.RADARR]);
  });

  it('imdbRating is Radarr-only — no OMDB integration exists in this deployment', () => {
    expect(getRule('imdbRating', 'movie')!.sourceProviders).toEqual([MetadataProviderType.RADARR]);
  });

  it('communityRating is Sonarr-only — Sonarr ratings is a single aggregate, no TMDB key configured', () => {
    expect(getRule('communityRating', 'show')!.sourceProviders).toEqual([
      MetadataProviderType.SONARR,
    ]);
  });
});

// ─── deriveSourceProviders ─────────────────────────────────────────────────
// For a rule backed by an EnrichmentFields-tracked field, sourceProviders is
// derived from fieldsByProviderType (the same declaration MediaFieldProvider/
// MediaFieldSource adapters are checked against) instead of hand-listed —
// a provider rename/removal there can't silently leave a rule's gating stale.

describe('deriveSourceProviders', () => {
  it('derives tmdbStatus to [TMDB]', () => {
    expect(deriveSourceProviders('tmdbStatus')).toEqual([MetadataProviderType.TMDB]);
  });

  it('derives playCount to both Tautulli and Plex — a contested field', () => {
    expect(deriveSourceProviders('playCount')).toEqual([
      MetadataProviderType.TAUTULLI,
      MetadataProviderType.PLEX,
    ]);
  });

  it('derives tags to both Radarr and Sonarr — each owns tags on its own kind', () => {
    expect(deriveSourceProviders('tags')).toEqual([
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
    ]);
  });
});

// ─── getRule lookup ──────────────────────────────────────────────────────

describe('getRule', () => {
  it('returns definition for (tagIds, movie)', () => {
    const rule = getRule('tagIds', 'movie');
    expect(rule).toBeDefined();
    expect(rule!.contentTypes).toContain('movie');
  });

  it('returns definition for (tagIds, show)', () => {
    const rule = getRule('tagIds', 'show');
    expect(rule).toBeDefined();
    expect(rule!.contentTypes).toContain('show');
  });

  it('returns undefined for unknown key', () => {
    expect(getRule('nonexistent', 'movie')).toBeUndefined();
  });

  it('returns undefined when key exists but not for given contentType', () => {
    // imdbRating is movie-only
    expect(getRule('imdbRating', 'show')).toBeUndefined();
  });
});

// ─── instanceScoped classification ─────────────────────────────────────────────
// Rules whose values are provider-*defined* id spaces (a quality profile id is
// minted by one instance) must be flagged so the client knows to qualify them
// per instance rather than treating them as universal.

describe('instanceScoped classification', () => {
  it('flags qualityProfileIds and tagIds as instance-scoped for both content types', () => {
    expect(getRule('qualityProfileIds', 'movie')!.instanceScoped).toBe(true);
    expect(getRule('qualityProfileIds', 'show')!.instanceScoped).toBe(true);
    expect(getRule('tagIds', 'movie')!.instanceScoped).toBe(true);
    expect(getRule('tagIds', 'show')!.instanceScoped).toBe(true);
  });

  it('leaves universal rules unscoped', () => {
    expect(getRule('genres', 'movie')!.instanceScoped).toBeFalsy();
    expect(getRule('certification', 'movie')!.instanceScoped).toBeFalsy();
    expect(getRule('network', 'show')!.instanceScoped).toBeFalsy();
  });
});

// ─── Movie predicates ────────────────────────────────────────────────────────

describe('movie predicates', () => {
  it('title — matches substring case-insensitively', () => {
    const rule = getRule('title', 'movie')!;
    expect(rule.predicate(baseMovie, 'inception')).toBe(true);
    expect(rule.predicate(baseMovie, 'INCEP')).toBe(true);
    expect(rule.predicate(baseMovie, 'Avatar')).toBe(false);
  });

  it('year — passes within min/max bounds', () => {
    const rule = getRule('year', 'movie')!;
    expect(rule.predicate(baseMovie, { min: 2010 })).toBe(true);
    expect(rule.predicate(baseMovie, { min: 2011 })).toBe(false);
    expect(rule.predicate(baseMovie, { max: 2010 })).toBe(true);
    expect(rule.predicate(baseMovie, { max: 2009 })).toBe(false);
    expect(rule.predicate(baseMovie, { min: 2000, max: 2020 })).toBe(true);
    expect(rule.predicate({ ...baseMovie, year: undefined }, { min: 2010 })).toBe(false);
  });

  it('hasFile — matches boolean exactly', () => {
    const rule = getRule('hasFile', 'movie')!;
    expect(rule.predicate(baseMovie, true)).toBe(true);
    expect(rule.predicate(baseMovie, false)).toBe(false);
  });

  it('tagIds — passes when item has any of the csv tag ids', () => {
    const rule = getRule('tagIds', 'movie')!;
    expect(rule.predicate(baseMovie, '10,30')).toBe(true);
    expect(rule.predicate(baseMovie, '99,100')).toBe(false);
  });

  it('qualityProfileIds — passes when item profile is in csv list', () => {
    const rule = getRule('qualityProfileIds', 'movie')!;
    expect(rule.predicate(baseMovie, '1,2')).toBe(true);
    expect(rule.predicate(baseMovie, '5,6')).toBe(false);
  });

  it('genres — passes when item has any of the csv genres', () => {
    const rule = getRule('genres', 'movie')!;
    expect(rule.predicate(baseMovie, 'Sci-Fi,Horror')).toBe(true);
    expect(rule.predicate(baseMovie, 'Romance')).toBe(false);
  });

  it('addedDaysAgo — passes within min/max bounds', () => {
    const rule = getRule('addedDaysAgo', 'movie')!;
    expect(rule.predicate(baseMovie, { min: 5 })).toBe(true); // added 10 days ago, gte 5
    expect(rule.predicate(baseMovie, { min: 15 })).toBe(false); // added 10 days ago, gte 15
    expect(rule.predicate(baseMovie, { max: 15 })).toBe(true); // added 10 days ago, lte 15
    expect(rule.predicate(baseMovie, { max: 5 })).toBe(false); // added 10 days ago, lte 5
    expect(rule.predicate({ ...baseMovie, addedDate: undefined }, { min: 5 })).toBe(false);
  });

  it('plexAddedDaysAgo — passes within min/max bounds', () => {
    const rule = getRule('plexAddedDaysAgo', 'movie')!;
    expect(rule.predicate(baseMovie, { min: 5 })).toBe(true); // added 10 days ago, gte 5
  });

  it('plexAddedDaysAgo — fails when item has no plexAddedAt', () => {
    const rule = getRule('plexAddedDaysAgo', 'movie')!;
    expect(rule.predicate({ ...baseMovie, plexAddedAt: undefined }, { min: 5 })).toBe(false);
  });

  it('sizeOnDiskGb — passes within min/max bounds (GB)', () => {
    const rule = getRule('sizeOnDiskGb', 'movie')!;
    expect(rule.predicate(baseMovie, { min: 4 })).toBe(true);
    expect(rule.predicate(baseMovie, { min: 6 })).toBe(false);
    expect(rule.predicate(baseMovie, { max: 6 })).toBe(true);
    expect(rule.predicate(baseMovie, { max: 4 })).toBe(false);
    expect(rule.predicate({ ...baseMovie, sizeOnDiskBytes: undefined }, { min: 4 })).toBe(false);
  });

  it('certification — matches case-insensitively against csv list', () => {
    const rule = getRule('certification', 'movie')!;
    expect(rule.predicate(baseMovie, 'PG-13,R')).toBe(true);
    expect(rule.predicate(baseMovie, 'pg-13')).toBe(true);
    expect(rule.predicate(baseMovie, 'G')).toBe(false);
  });

  it('imdbRating — passes within min/max bounds', () => {
    const rule = getRule('imdbRating', 'movie')!;
    expect(rule.predicate(baseMovie, { min: 8.0 })).toBe(true);
    expect(rule.predicate(baseMovie, { min: 9.0 })).toBe(false);
    expect(rule.predicate(baseMovie, { max: 9.0 })).toBe(true);
    expect(rule.predicate(baseMovie, { max: 7.0 })).toBe(false);
    expect(rule.predicate({ ...baseMovie, imdbRating: undefined }, { min: 8.0 })).toBe(false);
  });

  it('watched — passes when playCount > 0', () => {
    const rule = getRule('watched', 'movie')!;
    expect(rule.predicate(baseMovie, true)).toBe(true); // playCount=3
    expect(rule.predicate({ ...baseMovie, playCount: 0 }, true)).toBe(false);
    expect(rule.predicate(baseMovie, false)).toBe(false);
    expect(rule.predicate({ ...baseMovie, playCount: 0 }, false)).toBe(true);
  });
});

// ─── Show predicates ─────────────────────────────────────────────────────────

describe('show predicates', () => {
  it('title — show', () => {
    const rule = getRule('title', 'show')!;
    expect(rule.predicate(baseShow, 'breaking')).toBe(true);
    expect(rule.predicate(baseShow, 'Dexter')).toBe(false);
  });

  it('year — show', () => {
    const rule = getRule('year', 'show')!;
    expect(rule.predicate(baseShow, { min: 2008, max: 2008 })).toBe(true);
    expect(rule.predicate(baseShow, { min: 2009 })).toBe(false);
    expect(rule.predicate(baseShow, { max: 2007 })).toBe(false);
  });

  it('hasFile — show', () => {
    const rule = getRule('hasFile', 'show')!;
    expect(rule.predicate(baseShow, true)).toBe(true);
    expect(rule.predicate(baseShow, false)).toBe(false);
  });

  it('tagIds — show', () => {
    const rule = getRule('tagIds', 'show')!;
    expect(rule.predicate(baseShow, '5,99')).toBe(true);
    expect(rule.predicate(baseShow, '99')).toBe(false);
  });

  it('qualityProfileIds — show', () => {
    const rule = getRule('qualityProfileIds', 'show')!;
    expect(rule.predicate(baseShow, '2,3')).toBe(true);
    expect(rule.predicate(baseShow, '99')).toBe(false);
  });

  it('genres — show', () => {
    const rule = getRule('genres', 'show')!;
    expect(rule.predicate(baseShow, 'Drama,Comedy')).toBe(true);
    expect(rule.predicate(baseShow, 'Horror')).toBe(false);
  });

  it('monitored — show', () => {
    const rule = getRule('monitored', 'show')!;
    expect(rule.predicate(baseShow, false)).toBe(true);
    expect(rule.predicate(baseShow, true)).toBe(false);
  });

  it('seriesStatus — show', () => {
    const rule = getRule('seriesStatus', 'show')!;
    expect(rule.predicate(baseShow, 'ended')).toBe(true);
    expect(rule.predicate(baseShow, 'continuing')).toBe(false);
  });

  it('seriesType — show', () => {
    const rule = getRule('seriesType', 'show')!;
    expect(rule.predicate(baseShow, 'standard')).toBe(true);
    expect(rule.predicate(baseShow, 'anime')).toBe(false);
  });

  it('network — show, csv list', () => {
    const rule = getRule('network', 'show')!;
    expect(rule.predicate(baseShow, 'AMC,HBO')).toBe(true);
    expect(rule.predicate(baseShow, 'HBO')).toBe(false);
  });

  it('addedDaysAgo — show', () => {
    const rule = getRule('addedDaysAgo', 'show')!;
    expect(rule.predicate(baseShow, { min: 10 })).toBe(true); // added 20 days ago
    expect(rule.predicate(baseShow, { min: 30 })).toBe(false);
    expect(rule.predicate(baseShow, { max: 30 })).toBe(true);
    expect(rule.predicate(baseShow, { max: 10 })).toBe(false);
  });

  it('sizeOnDiskGb — show', () => {
    const rule = getRule('sizeOnDiskGb', 'show')!;
    expect(rule.predicate(baseShow, { min: 15 })).toBe(true);
    expect(rule.predicate(baseShow, { min: 25 })).toBe(false);
    expect(rule.predicate(baseShow, { max: 25 })).toBe(true);
    expect(rule.predicate(baseShow, { max: 15 })).toBe(false);
  });

  it('certification — show', () => {
    const rule = getRule('certification', 'show')!;
    expect(rule.predicate(baseShow, 'TV-MA')).toBe(true);
    expect(rule.predicate(baseShow, 'TV-PG')).toBe(false);
  });

  it('communityRating — show', () => {
    const rule = getRule('communityRating', 'show')!;
    expect(rule.predicate(baseShow, { min: 9.0 })).toBe(true);
    expect(rule.predicate(baseShow, { min: 10.0 })).toBe(false);
    expect(rule.predicate(baseShow, { max: 10.0 })).toBe(true);
    expect(rule.predicate(baseShow, { max: 8.0 })).toBe(false);
    expect(rule.predicate({ ...baseShow, communityRating: undefined }, { min: 9.0 })).toBe(false);
  });

  it('ended — show', () => {
    const rule = getRule('ended', 'show')!;
    expect(rule.predicate(baseShow, true)).toBe(true);
    expect(rule.predicate(baseShow, false)).toBe(false);
  });

  it('lastAiredDaysAgo — show', () => {
    const rule = getRule('lastAiredDaysAgo', 'show')!;
    expect(rule.predicate(baseShow, { min: 50 })).toBe(true); // aired 100 days ago
    expect(rule.predicate(baseShow, { min: 150 })).toBe(false);
    expect(rule.predicate(baseShow, { max: 150 })).toBe(true);
    expect(rule.predicate(baseShow, { max: 50 })).toBe(false);
    expect(rule.predicate({ ...baseShow, lastAiredAt: undefined }, { min: 50 })).toBe(false);
  });

  it('episodePercentage — show', () => {
    const rule = getRule('episodePercentage', 'show')!;
    expect(rule.predicate(baseShow, { min: 90 })).toBe(true);
    expect(rule.predicate(baseShow, { min: 100 })).toBe(false);
    expect(rule.predicate(baseShow, { max: 100 })).toBe(true);
    expect(rule.predicate(baseShow, { max: 80 })).toBe(false);
    expect(rule.predicate({ ...baseShow, episodePercentage: undefined }, { min: 90 })).toBe(false);
  });

  it('watched — show', () => {
    const rule = getRule('watched', 'show')!;
    expect(rule.predicate(baseShow, false)).toBe(true); // playCount=0
    expect(rule.predicate({ ...baseShow, playCount: 2 }, true)).toBe(true);
  });

  it('tmdbStatus — movie: true when tmdbStatus matches value', () => {
    const rule = getRule('tmdbStatus', 'movie')!;
    expect(rule.predicate({ ...baseMovie, tmdbStatus: 'Ended' }, 'Ended')).toBe(true);
    expect(rule.predicate({ ...baseMovie, tmdbStatus: 'In Production' }, 'Ended')).toBe(false);
    expect(rule.predicate({ ...baseMovie, tmdbStatus: undefined }, 'Ended')).toBe(false);
  });

  it('overseerrRequestStatus — movie: true when overseerrRequestStatus equals value', () => {
    const rule = getRule('overseerrRequestStatus', 'movie')!;
    expect(rule.predicate({ ...baseMovie, overseerrRequestStatus: 2 }, 2)).toBe(true);
    expect(rule.predicate({ ...baseMovie, overseerrRequestStatus: 1 }, 2)).toBe(false);
    expect(rule.predicate({ ...baseMovie, overseerrRequestStatus: undefined }, 2)).toBe(false);
  });

  it('overseerrHasIssue — movie: true when overseerrHasIssue matches value', () => {
    const rule = getRule('overseerrHasIssue', 'movie')!;
    expect(rule.predicate({ ...baseMovie, overseerrHasIssue: true }, true)).toBe(true);
    expect(rule.predicate({ ...baseMovie, overseerrHasIssue: false }, true)).toBe(false);
    expect(rule.predicate({ ...baseMovie, overseerrHasIssue: undefined }, true)).toBe(false);
  });

  it('overseerrHasIssue — movie: unknown (null/undefined) reads as "no issue" (truthy/falsy)', () => {
    const rule = getRule('overseerrHasIssue', 'movie')!;
    // Data stores truth (null = Overseerr said nothing); the filter treats unknown as falsy,
    // so "has issue = false" includes items with no reported issue.
    expect(rule.predicate({ ...baseMovie, overseerrHasIssue: undefined }, false)).toBe(true);
  });

  it('lastWatchedDaysAgo — movie: passes within min/max bounds', () => {
    const rule = getRule('lastWatchedDaysAgo', 'movie')!;
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(rule.predicate({ ...baseMovie, lastWatchedAt: twoDaysAgo }, { max: 7 })).toBe(true);
    expect(rule.predicate({ ...baseMovie, lastWatchedAt: tenDaysAgo }, { max: 7 })).toBe(false);
    expect(rule.predicate({ ...baseMovie, lastWatchedAt: tenDaysAgo }, { min: 7 })).toBe(true);
    expect(rule.predicate({ ...baseMovie, lastWatchedAt: twoDaysAgo }, { min: 7 })).toBe(false);
    expect(rule.predicate({ ...baseMovie, lastWatchedAt: undefined }, { max: 7 })).toBe(false);
  });
});
