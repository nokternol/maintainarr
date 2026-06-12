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
  it('emits one contribution per rating_key with play count and most-recent played_at', () => {
    const older = 1000;
    const newer = 2000;
    const result = mapTautulliHistory([
      history('abc123', older),
      history('abc123', newer),
      history('other', 3000),
    ]);

    const abc = result.find((c) => c.key.plexRatingKey === 'abc123');
    expect(abc?.values.tautulliPlayCount).toBe(2);
    expect(abc?.values.tautulliLastPlayed).toBe(newer);
  });
});

describe('mapPlexItems', () => {
  it('emits a contribution per ratingKey with view count and last-viewed', () => {
    const items: PlexMediaItem[] = [
      { ratingKey: 'plex-101', title: 'M', type: 'movie', viewCount: 5, lastViewedAt: 1700000000 },
      { ratingKey: 'plex-999', title: 'O', type: 'movie', viewCount: 2, lastViewedAt: 1600000000 },
    ];

    const result = mapPlexItems(items);

    const item = result.find((c) => c.key.plexRatingKey === 'plex-101');
    expect(item?.values.plexViewCount).toBe(5);
    expect(item?.values.plexLastViewedAt).toBe(1700000000);
  });
});

describe('mapOverseerr', () => {
  it('keys request status and issue presence by tmdbId', () => {
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

    const c100 = result.find((c) => c.key.tmdbId === 100);
    expect(c100?.values.overseerrRequestStatus).toBe(2);
    expect(c100?.values.overseerrHasIssue).toBe(true);
    expect(result.find((c) => c.key.tmdbId === 999)?.values.overseerrRequestStatus).toBe(3);
  });
});
