import type { TautulliHistoryItem } from '../providers';

/**
 * The canonical fields any provider may contribute, whether by decorating an
 * existing item (`MediaFieldProvider`) or by constructing one from scratch
 * (`MediaFieldSource`). Hand-authored and type-only — never read or branched
 * on at runtime. Every adapter's `toEnrichmentFields` return is checked
 * against it, which is what catches a field-type disagreement between two
 * providers at compile time.
 */
export interface EnrichmentFields {
  tags: number[];
  playCount: number;
  lastWatchedAt: string;
}

/**
 * A provider that builds an entire canonical item from one raw item, always
 * 1:1, with no existing item to decorate. `toEnrichmentFields` is the single
 * checked transform from the provider's own representation to `TFields`.
 */
export interface MediaFieldSource<TMediaField, TFields extends Partial<EnrichmentFields>> {
  toEnrichmentFields(native: TMediaField): TFields;
}

/**
 * A provider that decorates fields onto an already-existing item, joined by
 * key across a batch. `visit` maps raw provider data into the provider's own
 * native representation, keyed by the logical key the provider speaks;
 * `toEnrichmentFields` is the same checked transform `MediaFieldSource` uses,
 * applied per matched item.
 */
export interface MediaFieldProvider<TRaw, TMediaField, TFields extends Partial<EnrichmentFields>> {
  visit(raw: TRaw): Map<string, TMediaField>;
  toEnrichmentFields(native: TMediaField): TFields;
}

export const radarrTagsFieldSource: MediaFieldSource<number[], Pick<EnrichmentFields, 'tags'>> = {
  toEnrichmentFields: (tags) => ({ tags }),
};

/** Tautulli's own representation: play count plus the last play as a unix timestamp. */
interface TautulliNativeFields {
  playCount: number;
  lastPlayedUnix?: number;
}

const toIso = (unix: number): string => new Date(unix * 1000).toISOString();

export const tautulliFieldProvider: MediaFieldProvider<
  TautulliHistoryItem[],
  TautulliNativeFields,
  Pick<EnrichmentFields, 'playCount' | 'lastWatchedAt'>
> = {
  visit: (history) => {
    const byKey = new Map<string, TautulliNativeFields>();
    for (const item of history) {
      const existing = byKey.get(item.rating_key);
      const playCount = (existing?.playCount ?? 0) + 1;
      const lastPlayedUnix =
        item.played_at !== undefined &&
        (existing?.lastPlayedUnix === undefined || item.played_at > existing.lastPlayedUnix)
          ? item.played_at
          : existing?.lastPlayedUnix;
      byKey.set(item.rating_key, { playCount, lastPlayedUnix });
    }
    return byKey;
  },
  toEnrichmentFields: (native) => ({
    playCount: native.playCount,
    lastWatchedAt: native.lastPlayedUnix !== undefined ? toIso(native.lastPlayedUnix) : '',
  }),
};
