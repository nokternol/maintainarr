import type { NormalizedMovie } from './movie';
import type { NormalizedShow } from './show';

/** The canonical media model every provider role acts on — a movie or a show. */
export type MediaItem = NormalizedMovie | NormalizedShow;

/** The transient result of resolving a source: its normalized items. */
export type MediaItemSet = MediaItem[];
