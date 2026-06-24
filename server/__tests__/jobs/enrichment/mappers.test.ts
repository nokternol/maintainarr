import { mapOverseerr, mapPlexItems, mapTautulliHistory } from '@server/jobs/enrichment/mappers';
import type { OverseerrIssue, OverseerrRequest } from '@server/providers/overseerrProvider';
import type { PlexMediaItem } from '@server/providers/plexProvider';
import type { TautulliHistoryItem } from '@server/providers/tautulliProvider';
import { describe, expect, it } from 'vitest';

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

describe('mapTautulliHistory', () => {
  it('maps canonical play count and ISO most-recent watch per rating_key', () => {
    const older = 1000;
    const newer = 2000;
    const result = mapTautulliHistory([
      history('abc123', older),
      history('abc123', newer),
      history('other', 3000),
    ]);

    expect(result.get('abc123')).toEqual({
      playCount: 2,
      lastWatchedAt: new Date(newer * 1000).toISOString(),
    });
  });
});

describe('mapPlexItems', () => {
  it('maps canonical play count and ISO last-viewed per ratingKey', () => {
    const items: PlexMediaItem[] = [
      { ratingKey: 'plex-101', title: 'M', type: 'movie', viewCount: 5, lastViewedAt: 1700000000 },
    ];

    expect(mapPlexItems(items).get('plex-101')).toEqual({
      playCount: 5,
      lastWatchedAt: new Date(1700000000 * 1000).toISOString(),
    });
  });
});

describe('mapOverseerr', () => {
  it('maps request status and issue presence by tmdbId', () => {
    const requests: OverseerrRequest[] = [
      {
        id: 1,
        status: 2,
        type: 'movie',
        requestedBy: { id: 1, displayName: 'u', email: 'u@u.com' },
        media: { tmdbId: 100, title: 'Test' },
        createdAt: '',
      },
      {
        id: 2,
        status: 3,
        type: 'movie',
        requestedBy: { id: 1, displayName: 'u', email: 'u@u.com' },
        media: { tmdbId: 999, title: 'Other' },
        createdAt: '',
      },
    ];
    const issues: OverseerrIssue[] = [{ id: 1, status: 1, media: { tmdbId: 100 } }];

    const result = mapOverseerr(requests, issues);

    expect(result.get(100)).toEqual({ overseerrRequestStatus: 2, overseerrHasIssue: true });
    expect(result.get(999)).toEqual({ overseerrRequestStatus: 3 });
  });
});
