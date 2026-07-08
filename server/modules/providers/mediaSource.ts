import type { NormalizedMovie } from '@server/domain/movie';
import type { NormalizedShow } from '@server/domain/show';

/** The canonical media model every role acts on — a movie or a show. */
export type MediaItem = NormalizedMovie | NormalizedShow;

/** The transient result of resolving a source: its normalized items. */
export type MediaItemSet = MediaItem[];

/**
 * The read role a media-owning provider plays for the query engine. A source
 * advertises normalized "media items" — not movies or series — projects each
 * item back to its provider id, and names the enrichment table its ids live in.
 * `RadarrProvider` serves movies and `SonarrProvider` serves shows, but the
 * engine consumes only this role and never sees that distinction.
 */
export interface MediaSource {
  getMediaItems(): Promise<MediaItemSet>;
  idOf(item: NormalizedMovie | NormalizedShow): number | undefined;
  readonly enrichmentSourceType: 'RADARR' | 'SONARR';
}
