import { summarizeFilters } from '@app/lib/utils/filterSummary';
import { describe, expect, it } from 'vitest';

describe('summarizeFilters', () => {
  it('labels plexAddedDaysAgoGte/Lte instead of falling back to the raw key', () => {
    const parts = summarizeFilters([
      { key: 'plexAddedDaysAgoGte', value: 5 },
      { key: 'plexAddedDaysAgoLte', value: 15 },
    ]);

    expect(parts).toEqual(['Plex added ≥ days: 5', 'Plex added ≤ days: 15']);
  });
});
