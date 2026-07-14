import type {
  OverseerrIssue,
  OverseerrRequest,
  PlexMediaItem,
  TautulliHistoryItem,
} from '../providers';

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
  overseerrRequestStatus: number;
  overseerrHasIssue: boolean;
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
export interface MediaFieldProvider<
  TRaw,
  TMediaField,
  TFields extends Partial<EnrichmentFields>,
  TKey extends string | number = string,
> {
  visit(raw: TRaw): Map<TKey, TMediaField>;
  toEnrichmentFields(native: TMediaField): TFields;
}

export const radarrTagsFieldSource: MediaFieldSource<number[], Pick<EnrichmentFields, 'tags'>> = {
  toEnrichmentFields: (tags) => ({ tags }),
};

/**
 * The play-history shape Tautulli and Plex both natively report: play count
 * plus the last play as a unix timestamp. Shared because it's genuinely the
 * same representation for both, not merely a coincidence of two adapters.
 */
interface PlayHistoryFields {
  playCount: number;
  lastPlayedUnix?: number;
}

const toIso = (unix: number): string => new Date(unix * 1000).toISOString();

/** The `toEnrichmentFields` transform every play-history provider shares. */
function playHistoryToEnrichmentFields(
  native: PlayHistoryFields
): Partial<Pick<EnrichmentFields, 'playCount' | 'lastWatchedAt'>> {
  return {
    playCount: native.playCount,
    ...(native.lastPlayedUnix !== undefined ? { lastWatchedAt: toIso(native.lastPlayedUnix) } : {}),
  };
}

export const tautulliFieldProvider: MediaFieldProvider<
  TautulliHistoryItem[],
  PlayHistoryFields,
  Partial<Pick<EnrichmentFields, 'playCount' | 'lastWatchedAt'>>
> = {
  visit: (history) => {
    const byKey = new Map<string, PlayHistoryFields>();
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
  toEnrichmentFields: playHistoryToEnrichmentFields,
};

/** Overseerr's own representation: request status and whether an issue is open. */
interface OverseerrNativeFields {
  requestStatus?: number;
  hasIssue?: boolean;
}

export const overseerrFieldProvider: MediaFieldProvider<
  [OverseerrRequest[], OverseerrIssue[]],
  OverseerrNativeFields,
  Partial<Pick<EnrichmentFields, 'overseerrRequestStatus' | 'overseerrHasIssue'>>,
  number
> = {
  visit: ([requests, issues]) => {
    const byTmdbId = new Map<number, OverseerrNativeFields>();
    const get = (tmdbId: number): OverseerrNativeFields => {
      let f = byTmdbId.get(tmdbId);
      if (!f) {
        f = {};
        byTmdbId.set(tmdbId, f);
      }
      return f;
    };
    for (const req of requests) get(req.media.tmdbId).requestStatus = req.status;
    for (const issue of issues) get(issue.media.tmdbId).hasIssue = true;
    return byTmdbId;
  },
  toEnrichmentFields: (native) => ({
    ...(native.requestStatus !== undefined ? { overseerrRequestStatus: native.requestStatus } : {}),
    ...(native.hasIssue !== undefined ? { overseerrHasIssue: native.hasIssue } : {}),
  }),
};

export const plexFieldProvider: MediaFieldProvider<
  PlexMediaItem[],
  PlayHistoryFields,
  Partial<Pick<EnrichmentFields, 'playCount' | 'lastWatchedAt'>>
> = {
  visit: (items) => {
    const byKey = new Map<string, PlayHistoryFields>();
    for (const item of items) {
      byKey.set(item.ratingKey, {
        playCount: item.viewCount ?? 0,
        lastPlayedUnix: item.lastViewedAt,
      });
    }
    return byKey;
  },
  toEnrichmentFields: playHistoryToEnrichmentFields,
};
