import {
  radarrTagsFieldSource,
  tautulliFieldProvider,
} from '@server/modules/media/mediaFieldProvider';
import type { TautulliHistoryItem } from '@server/modules/providers';
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
});
