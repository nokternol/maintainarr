import type { MediaItem } from '@server/modules/media/mediaItem';
import type { OverseerrIssue, OverseerrRequest } from '../connections/overseerrProvider';
import type { PlexMediaItem } from '../connections/plexProvider';
import type { TautulliHistoryItem } from '../connections/tautulliProvider';

const toIso = (unix: number): string => new Date(unix * 1000).toISOString();

/**
 * Pure: Tautulli history rows → canonical fields keyed by plexRatingKey — play
 * count (row count) and the ISO timestamp of the most-recent play. The functional
 * core of `TautulliProvider.enrich`, ready for `decorate`.
 */
export function mapTautulliHistory(
  history: TautulliHistoryItem[]
): Map<string, Pick<MediaItem, 'playCount' | 'lastWatchedAt'>> {
  const playCount = new Map<string, number>();
  const lastPlayed = new Map<string, number>();
  for (const item of history) {
    playCount.set(item.rating_key, (playCount.get(item.rating_key) ?? 0) + 1);
    if (item.played_at !== undefined) {
      const current = lastPlayed.get(item.rating_key) ?? 0;
      if (item.played_at > current) lastPlayed.set(item.rating_key, item.played_at);
    }
  }
  const fields = new Map<string, Pick<MediaItem, 'playCount' | 'lastWatchedAt'>>();
  for (const [plexRatingKey, count] of playCount) {
    const last = lastPlayed.get(plexRatingKey);
    fields.set(plexRatingKey, {
      playCount: count,
      lastWatchedAt: last !== undefined ? toIso(last) : undefined,
    });
  }
  return fields;
}

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
