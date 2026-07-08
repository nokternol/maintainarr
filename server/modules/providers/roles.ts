import type { MetadataProviderType } from '@server/database/schema';
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
 * The pure-data projection of an actuator task: how it is presented (`id`,
 * `label`, `destructive`) and what data scope it touches (`affects`). This is
 * the transport and discovery shape — it serializes complete, carrying no
 * runner.
 */
export interface ActuatorTaskDescriptor {
  id: string;
  label: string;
  destructive: boolean;
  affects?: 'media';
}

/**
 * A descriptor plus its runner, bound to the concrete provider instance (no
 * cast). The execution shape: the executor reads `run`, discovery reads the
 * descriptor it extends — projecting one from the other is lossless.
 */
export interface ActuatorTask extends ActuatorTaskDescriptor {
  run(ids: number[]): Promise<void>;
}

/**
 * The runner for a modelled task: a capability declared in the right shape but
 * not yet wired to a real provider call. It rejects on invocation so a modelled
 * task is never silently a no-op; enablement defaulting off keeps it
 * unreachable by accident.
 */
export function modelledRun(taskId: string): (ids: number[]) => Promise<void> {
  return () => Promise.reject(new Error(`Task "${taskId}" is not yet implemented`));
}

/**
 * A system that exposes an API to perform actions on media it can address. It
 * is the sole authority for what actuator tasks exist: a configured instance
 * declares its own tasks, each carrying a runner bound to this instance. A
 * system without this role has no tasks by construction.
 */
export interface MediaActuator {
  readonly actuatorType: MetadataProviderType;
  tasks(): ActuatorTask[];
}

/** Whether a constructed provider plays the `MediaActuator` role. */
export function isMediaActuator(provider: object): provider is MediaActuator {
  return typeof (provider as Partial<MediaActuator>).tasks === 'function';
}
