import {
  ENRICHMENT_DEFAULTS,
  type EnrichmentValues,
  toEnrichmentValues,
} from '@server/jobs/enrichment/types';
import { describe, expect, it } from 'vitest';

describe('ENRICHMENT_DEFAULTS', () => {
  it('is the single source of truth: every field defaults to null', () => {
    expect(ENRICHMENT_DEFAULTS).toEqual({
      tautulliPlayCount: null,
      tautulliLastPlayed: null,
      plexViewCount: null,
      plexLastViewedAt: null,
      overseerrRequestStatus: null,
      overseerrHasIssue: null,
    });
  });
});

describe('toEnrichmentValues', () => {
  it('materializes every canonical field — an empty fragment becomes the all-null record', () => {
    expect(toEnrichmentValues({})).toEqual(ENRICHMENT_DEFAULTS);
  });

  it('cannot silently drop a field: its key set is exactly the canonical field set', () => {
    expect(Object.keys(toEnrichmentValues({})).sort()).toEqual(
      Object.keys(ENRICHMENT_DEFAULTS).sort()
    );
  });

  it('preserves provided values and leaves the rest null', () => {
    const partial: Partial<EnrichmentValues> = {
      tautulliPlayCount: 3,
      overseerrHasIssue: true,
    };

    expect(toEnrichmentValues(partial)).toEqual({
      ...ENRICHMENT_DEFAULTS,
      tautulliPlayCount: 3,
      overseerrHasIssue: true,
    });
  });

  it('treats an undefined fragment value as "not provided" and fills it back to null', () => {
    const partial: Partial<EnrichmentValues> = {
      plexViewCount: undefined,
      plexLastViewedAt: 1700000000,
    };

    expect(toEnrichmentValues(partial)).toMatchObject({
      plexViewCount: null,
      plexLastViewedAt: 1700000000,
    });
  });

  it('preserves a provided value of 0 rather than nulling it', () => {
    expect(toEnrichmentValues({ plexViewCount: 0 })).toMatchObject({ plexViewCount: 0 });
  });
});
