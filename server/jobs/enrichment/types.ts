import type { Contribution } from '../../utils/contributions';

/** External identifiers a contribution can be matched against an identity by. */
export interface EnrichmentKey {
  plexRatingKey?: string;
  tmdbId?: number;
}

/**
 * Canonical enrichment record. Each field's value type is `T | null` — `null` is the
 * real "unknown / not provided" value. `undefined` is NOT a value here; it only appears
 * transiently inside a `Partial<EnrichmentValues>` merge fragment (a source that doesn't
 * speak to a field), and is filled back to `null` by `toEnrichmentValues`.
 */
export interface EnrichmentValues {
  tautulliPlayCount: number | null;
  tautulliLastPlayed: number | null;
  plexViewCount: number | null;
  plexLastViewedAt: number | null;
  overseerrRequestStatus: number | null;
  overseerrHasIssue: boolean | null;
}

/** A contribution carries a partial fragment — only the fields its source provides. */
export type EnrichmentContribution = Contribution<EnrichmentKey, Partial<EnrichmentValues>>;

/** Materialize a merged partial into the canonical record: missing fields become null. */
export function toEnrichmentValues(partial: Partial<EnrichmentValues>): EnrichmentValues {
  return {
    tautulliPlayCount: partial.tautulliPlayCount ?? null,
    tautulliLastPlayed: partial.tautulliLastPlayed ?? null,
    plexViewCount: partial.plexViewCount ?? null,
    plexLastViewedAt: partial.plexLastViewedAt ?? null,
    overseerrRequestStatus: partial.overseerrRequestStatus ?? null,
    overseerrHasIssue: partial.overseerrHasIssue ?? null,
  };
}
