import type { OverseerrIssue, OverseerrRequest, PlexMediaItem } from '../../providers';
import type { MediaItem } from '../mediaItem';

const toIso = (unix: number): string => new Date(unix * 1000).toISOString();

/**
 * Pure: Plex library items → canonical fields keyed by ratingKey — view count and
 * the ISO timestamp it was last viewed.
 */
export function mapPlexItems(
  items: PlexMediaItem[]
): Map<string, Pick<MediaItem, 'playCount' | 'lastWatchedAt'>> {
  const fields = new Map<string, Pick<MediaItem, 'playCount' | 'lastWatchedAt'>>();
  for (const item of items) {
    fields.set(item.ratingKey, {
      playCount: item.viewCount,
      lastWatchedAt: item.lastViewedAt !== undefined ? toIso(item.lastViewedAt) : undefined,
    });
  }
  return fields;
}

/**
 * Pure: Overseerr requests + issues → canonical fields keyed by tmdbId. Emits only
 * positive knowledge — request status where a request exists, and an issue flag
 * where an open issue exists.
 */
export function mapOverseerr(
  requests: OverseerrRequest[],
  issues: OverseerrIssue[]
): Map<number, Partial<Pick<MediaItem, 'overseerrRequestStatus' | 'overseerrHasIssue'>>> {
  const fields = new Map<
    number,
    Partial<Pick<MediaItem, 'overseerrRequestStatus' | 'overseerrHasIssue'>>
  >();
  const get = (
    tmdbId: number
  ): Partial<Pick<MediaItem, 'overseerrRequestStatus' | 'overseerrHasIssue'>> => {
    let f = fields.get(tmdbId);
    if (!f) {
      f = {};
      fields.set(tmdbId, f);
    }
    return f;
  };
  for (const req of requests) get(req.media.tmdbId).overseerrRequestStatus = req.status;
  for (const issue of issues) get(issue.media.tmdbId).overseerrHasIssue = true;
  return fields;
}
