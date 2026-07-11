import type { NormalizedMovie } from './movie';
import type { NormalizedShow } from './show';

/** The canonical media model every provider role acts on — a movie or a show. */
export type MediaItem = NormalizedMovie | NormalizedShow;

/** The transient result of resolving a source: its normalized items. */
export type MediaItemSet = MediaItem[];

/** Provider-native id of a source-produced item. */
export function externalIdOf(item: MediaItem): number | undefined {
  const ids = item._sourceIds as { radarr?: number; sonarr?: number };
  return ids.radarr ?? ids.sonarr;
}

/**
 * Collision-free key for pooled matching: `${providerId}:${externalId}`. An internal
 * map/set key only — never an id that leaves the process (task.run speaks `idOf`).
 */
export function itemKey(item: MediaItem): string | undefined {
  const providerId = item._sourceIds.providerId;
  const externalId = externalIdOf(item);
  if (providerId === undefined || externalId === undefined) return undefined;
  return `${providerId}:${externalId}`;
}
