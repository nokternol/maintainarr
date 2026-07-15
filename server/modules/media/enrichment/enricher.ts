import type { MetadataProviderType } from '@server/database/schema';
import type { EnrichmentFields } from '../mediaFieldProvider';
import type { MediaItem } from '../mediaItem';

/**
 * The canonical fields any provider's enrichment may contribute — every field
 * `EnrichmentFields` declares except `tags`, which is `MediaFieldSource`'s
 * construction-only field (Radarr builds it as part of the item, never
 * decorates it onto an existing one). `EnrichmentFields` is the single
 * source of truth for field existence; this is just the enricher role's own
 * name for "any of its keys but the construction-only ones," so a new
 * enrichment field lands here automatically instead of needing a second
 * hand-copied union kept in sync.
 */
export type EnrichableField = Exclude<keyof EnrichmentFields, 'tags'>;

/**
 * A system that contributes metadata about media it does not own, joining the
 * catalog by a shared logical key it speaks (`_sourceIds.plex`, `_sourceIds.tmdb`,
 * …). It decorates the canonical `MediaItem`: given a batch, it returns only
 * the items it matched, carrying only its own fields, tagged with its
 * provider. `TField` is the subset of `EnrichableField` this enricher may
 * set — expressed as a `Pick` of media's own `MediaItem` wherever a
 * provider's contributed-field map is typed, so the subset relationship is
 * compiler-checked against the real canonical shape rather than duplicated.
 */
export interface MediaEnricher<TField extends EnrichableField = EnrichableField> {
  enrich(items: MediaItem[]): Promise<EnrichmentResult<TField>>;
}

/**
 * An enricher's contribution to one job pass: the items it touched, tagged with
 * the provider that produced them. Internal to the enrichment job — it carries
 * provenance for write-time precedence resolution and is never persisted nor
 * crosses a read boundary.
 */
export interface EnrichmentResult<TField extends EnrichableField = EnrichableField> {
  provider: MetadataProviderType;
  items: (MediaItem & Pick<MediaItem, TField>)[];
}
