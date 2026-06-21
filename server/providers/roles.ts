import type { MetadataProviderType } from '../database/schema';

export type { MediaSource } from './mediaSource';

/**
 * A system that contributes metadata about media it does not own, joined into
 * the enrichment graph by a shared logical key. Marks the concrete classes that
 * feed `media_enrichment`; the merge wiring lives in the enrichment services.
 */
export interface MetadataEnricher {
  readonly enrichmentSourceType: 'RADARR' | 'SONARR';
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
