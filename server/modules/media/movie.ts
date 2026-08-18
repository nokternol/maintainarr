import type { EnrichmentFields } from './mediaFieldProvider';

/**
 * Every `EnrichmentFields` key, not a hand-picked subset — no field is movie-only or
 * show-only within `EnrichmentFields` itself (that distinction lives in
 * `sourceProviders`/`contentTypes` instead), so `NormalizedShow` extends the identical
 * `Partial<EnrichmentFields>`. A new `EnrichmentFields` key is carried here
 * automatically; there is no separate list to remember to update, unlike the previous
 * hand-typed `Pick<EnrichmentFields, 'tags' | 'playCount' | ...>` union, which
 * compiled fine even when a key was silently missing from it.
 */
export interface NormalizedMovie extends Partial<EnrichmentFields> {
  _sourceIds: {
    radarr?: number;
    plex?: string;
    tmdb?: number;
    imdb?: string;
    jellyfin?: string;
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
