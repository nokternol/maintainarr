export interface NormalizedMovie {
  _sourceIds: { radarr?: number; plex?: string; tmdb?: number; imdb?: string };
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
