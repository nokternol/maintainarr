import type { MediaItem, MediaItemSet } from '@server/modules/media/mediaItem';

/**
 * The read role a media-owning provider plays for the query engine. A source
 * advertises normalized "media items" — not movies or series — projects each
 * item back to its provider id, and names the enrichment table its ids live in.
 * `RadarrProvider` serves movies and `SonarrProvider` serves shows, but the
 * engine consumes only this role and never sees that distinction.
 */
export interface MediaSource {
  getMediaItems(): Promise<MediaItemSet>;
  idOf(item: MediaItem): number | undefined;
  readonly enrichmentSourceType: 'RADARR' | 'SONARR';
}
