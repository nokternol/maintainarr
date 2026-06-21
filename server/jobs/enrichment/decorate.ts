import type { MediaItem } from '../../providers/mediaSource';

/**
 * Pure match-and-decorate: join a batch of canonical items to a per-key set of
 * fields by the logical key each item speaks, returning only the items that
 * matched — each a copy decorated with its fields. The functional core every
 * `MediaEnricher.enrich` shell shares: fetch and transform happen in the shell,
 * this join stays mock-free.
 */
export function decorate<K extends string | number>(
  items: MediaItem[],
  keyOf: (item: MediaItem) => K | undefined,
  fieldsByKey: Map<K, Partial<MediaItem>>
): MediaItem[] {
  const decorated: MediaItem[] = [];
  for (const item of items) {
    const key = keyOf(item);
    const fields = key !== undefined ? fieldsByKey.get(key) : undefined;
    if (fields) decorated.push({ ...item, ...fields });
  }
  return decorated;
}
