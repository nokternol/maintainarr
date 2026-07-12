export interface NormalizedMovie {
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
  tags?: number[];
  genres?: string[];
  addedDate?: string;
  sizeOnDiskBytes?: number;
  certification?: string;
  imdbRating?: number;
  tmdbRating?: number;
  playCount?: number;
  lastWatchedAt?: string;
  overseerrHasIssue?: boolean;
  overseerrRequestStatus?: number;
  tmdbStatus?: string;
}
