import { MetadataProviderType } from '@server/database/schema';

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

export type MediaKind = 'movie' | 'show';

/**
 * The single authority for `MediaSource` role membership: which provider type
 * owns which media kind's catalog. Every other surface derives from this map
 * rather than re-declaring it.
 */
export const SOURCE_OWNER_BY_KIND: Record<MediaKind, MetadataProviderType> = {
  movie: MetadataProviderType.RADARR,
  show: MetadataProviderType.SONARR,
};

const SOURCE_TYPES = new Set<MetadataProviderType>(Object.values(SOURCE_OWNER_BY_KIND));

/** Whether a provider type owns a media catalog (plays the `MediaSource` role). */
export function isMediaSourceType(type: MetadataProviderType): boolean {
  return SOURCE_TYPES.has(type);
}

/** The media kind a catalog-owning provider type owns, if any. */
export function kindOfSourceType(type: MetadataProviderType): MediaKind | undefined {
  return (Object.keys(SOURCE_OWNER_BY_KIND) as MediaKind[]).find(
    (kind) => SOURCE_OWNER_BY_KIND[kind] === type
  );
}
