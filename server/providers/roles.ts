import type { MetadataProviderType } from '../database/schema';
import type { MediaItem } from './mediaSource';

export type { MediaItem, MediaSource } from './mediaSource';

/**
 * A system that contributes metadata about media it does not own, joining the
 * catalog by a shared logical key it speaks (`_sourceIds.plex`, `_sourceIds.tmdb`,
 * …). It decorates the canonical `MediaItem`: given a batch, it returns only the
 * items it matched, carrying only its own fields, tagged with its provider.
 */
export interface MediaEnricher {
  enrich(items: MediaItem[]): Promise<EnrichmentResult>;
}

/**
 * An enricher's contribution to one job pass: the items it touched, tagged with
 * the provider that produced them. Internal to the enrichment job — it carries
 * provenance for write-time precedence resolution and is never persisted nor
 * crosses a read boundary.
 */
export interface EnrichmentResult {
  provider: MetadataProviderType;
  items: MediaItem[];
}

/**
 * A system that exposes an API to perform actions on media it can address.
 * Tasks are the actuator's public surface; their vocabulary is declared
 * server-side in the task manifest keyed by `actuatorType`, so a system without
 * this role has no tasks by construction.
 */
export interface MediaActuator {
  readonly actuatorType: MetadataProviderType;
}
