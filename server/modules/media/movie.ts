import type { EnrichmentFields } from './mediaFieldProvider';

/**
 * The 6 `EnrichmentFields`-tracked properties (`tags`, `playCount`,
 * `lastWatchedAt`, `overseerrHasIssue`, `overseerrRequestStatus`,
 * `tmdbStatus`) are derived from `EnrichmentFields`, not hand-typed — a
 * field-type change there now breaks this interface's consumers
 * (`enrichmentMerge.ts`'s direct assignments in particular) at compile
 * time instead of silently diverging.
 */
export interface NormalizedMovie
  extends Partial<
    Pick<
      EnrichmentFields,
      | 'tags'
      | 'playCount'
      | 'lastWatchedAt'
      | 'overseerrHasIssue'
      | 'overseerrRequestStatus'
      | 'tmdbStatus'
    >
  > {
  _sourceIds: {
    radarr?: number;
    plex?: string;
    tmdb?: number;
    imdb?: string;
    /** The configured instance this item came from — set by every source-produced item. */
    providerId?: number;
    /** The group this item was hydrated from — set only on enrichment-job hydrated items. */
    identity?: number;
  };
  title: string;
  year?: number;
  hasFile?: boolean;
  monitored?: boolean;
  qualityProfileId?: number;
  genres?: string[];
  addedDate?: string;
  sizeOnDiskBytes?: number;
  certification?: string;
  imdbRating?: number;
  tmdbRating?: number;
}
