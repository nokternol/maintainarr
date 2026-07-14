import { mapOverseerr, mapPlexItems } from '@server/modules/media/enrichment/mappers';
import type { OverseerrIssue, OverseerrRequest, PlexMediaItem } from '@server/modules/providers';
import { describe, expect, it } from 'vitest';

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
