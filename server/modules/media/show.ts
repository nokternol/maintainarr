export interface NormalizedShow {
  _sourceIds: {
    sonarr?: number;
    plex?: string;
    tmdb?: number;
    tvdb?: number;
    tvmaze?: number;
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
  seriesType?: 'standard' | 'daily' | 'anime';
  network?: string;
  status?: 'continuing' | 'ended' | 'upcoming';
  ended?: boolean;
  episodePercentage?: number;
  lastAiredAt?: string;
  communityRating?: number;
  playCount?: number;
  lastWatchedAt?: string;
  overseerrHasIssue?: boolean;
  overseerrRequestStatus?: number;
  tmdbStatus?: string;
}
