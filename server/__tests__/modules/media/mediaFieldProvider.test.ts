import {
  overseerrFieldProvider,
  plexFieldProvider,
  radarrTagsFieldSource,
  tautulliFieldProvider,
  tmdbFieldSource,
} from '@server/modules/media/mediaFieldProvider';
import type {
  OverseerrIssue,
  OverseerrRequest,
  PlexMediaItem,
  TautulliHistoryItem,
} from '@server/modules/providers';
import { describe, expect, it } from 'vitest';

describe('radarrTagsFieldSource', () => {
  it('transforms Radarr tags into the canonical tags field', () => {
    const result = radarrTagsFieldSource.toEnrichmentFields([10, 20]);

    expect(result).toEqual({ tags: [10, 20] });
  });
});

function history(rating_key: string, played_at?: number): TautulliHistoryItem {
  return {
    rating_key,
    title: 'T',
    watched_status: 1,
    duration: 3600,
    play_duration: 3600,
    user: 'u',
    ...(played_at !== undefined ? { played_at } : {}),
  } as TautulliHistoryItem;
}

describe('tautulliFieldProvider.visit', () => {
  it('aggregates play count per rating_key across history rows', () => {
    const result = tautulliFieldProvider.visit([
      history('abc123', 1000),
      history('abc123', 2000),
      history('other', 3000),
    ]);

    expect(result.get('abc123')?.playCount).toBe(2);
    expect(result.get('other')?.playCount).toBe(1);
  });
});

describe('tautulliFieldProvider.toEnrichmentFields', () => {
  it('converts the native unix timestamp into an ISO lastWatchedAt', () => {
    const native = tautulliFieldProvider.visit([history('abc123', 1700000000)]).get('abc123')!;

    const result = tautulliFieldProvider.toEnrichmentFields(native);

    expect(result).toEqual({
      playCount: 1,
      lastWatchedAt: new Date(1700000000 * 1000).toISOString(),
    });
  });

  it('omits lastWatchedAt entirely when no play carried a timestamp', () => {
    const native = tautulliFieldProvider.visit([history('abc123')]).get('abc123')!;

    const result = tautulliFieldProvider.toEnrichmentFields(native);

    expect(result).not.toHaveProperty('lastWatchedAt');
  });
});

function overseerrRequest(tmdbId: number, status: number): OverseerrRequest {
  return {
    id: 1,
    status,
    type: 'movie',
    requestedBy: { id: 1, displayName: 'u', email: 'u@u.com' },
    media: { tmdbId, title: 'T' },
    createdAt: '',
  };
}

function overseerrIssue(tmdbId: number): OverseerrIssue {
  return { id: 1, status: 1, media: { tmdbId } };
}

describe('overseerrFieldProvider.visit', () => {
  it('maps request status and issue presence by tmdbId', () => {
    const result = overseerrFieldProvider.visit([
      [overseerrRequest(100, 2), overseerrRequest(999, 3)],
      [overseerrIssue(100)],
    ]);

    expect(result.get(100)).toEqual({ requestStatus: 2, hasIssue: true });
    expect(result.get(999)).toEqual({ requestStatus: 3 });
  });
});

describe('plexFieldProvider.visit', () => {
  it('maps view count and last-viewed timestamp per ratingKey', () => {
    const items: PlexMediaItem[] = [
      { ratingKey: 'plex-101', title: 'M', type: 'movie', viewCount: 5, lastViewedAt: 1700000000 },
    ];

    const result = plexFieldProvider.visit(items);

    expect(result.get('plex-101')).toEqual({ playCount: 5, lastPlayedUnix: 1700000000 });
  });
});

describe('tmdbFieldSource', () => {
  it('transforms the raw TMDB status string into the canonical tmdbStatus field', () => {
    const result = tmdbFieldSource.toEnrichmentFields('Released');

    expect(result).toEqual({ tmdbStatus: 'Released' });
  });
});
