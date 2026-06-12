import type { Contribution } from '../../utils/contributions';

/** External identifiers a contribution can be matched against an identity by. */
export interface EnrichmentKey {
  plexRatingKey?: string;
  tmdbId?: number;
}

/**
 * Single source of truth for the canonical enrichment record: every field, its value type,
 * and its "unknown / not provided" default (always `null`) declared exactly once. Both the
 * {@link EnrichmentValues} type and {@link toEnrichmentValues} are derived from this object,
 * so adding a field is a one-line edit here and nothing can drift out of sync.
 *
 * `null` is the real "unknown" value. `undefined` is NOT a value; it only appears transiently
 * inside a `Partial<EnrichmentValues>` merge fragment (a source that doesn't speak to a field)
 * and is filled back to `null` by `toEnrichmentValues`.
 */
export const ENRICHMENT_DEFAULTS = {
  tautulliPlayCount: null as number | null,
  tautulliLastPlayed: null as number | null,
  plexViewCount: null as number | null,
  plexLastViewedAt: null as number | null,
  overseerrRequestStatus: null as number | null,
  overseerrHasIssue: null as boolean | null,
};

/** Canonical enrichment record — derived from {@link ENRICHMENT_DEFAULTS}. */
export type EnrichmentValues = typeof ENRICHMENT_DEFAULTS;

/** A contribution carries a partial fragment — only the fields its source provides. */
export type EnrichmentContribution = Contribution<EnrichmentKey, Partial<EnrichmentValues>>;

/** Materialize a merged partial into the canonical record: missing fields become null. */
export function toEnrichmentValues(partial: Partial<EnrichmentValues>): EnrichmentValues {
  const values = { ...ENRICHMENT_DEFAULTS };
  for (const key of Object.keys(values) as (keyof EnrichmentValues)[]) {
    const provided = partial[key];
    if (provided != null) {
      (values as Record<keyof EnrichmentValues, unknown>)[key] = provided;
    }
  }
  return values;
}
