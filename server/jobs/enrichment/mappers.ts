import type { OverseerrIssue, OverseerrRequest } from '../../providers/overseerrProvider';
import type { PlexMediaItem } from '../../providers/plexProvider';
import type { TautulliHistoryItem } from '../../providers/tautulliProvider';
import type { EnrichmentContribution } from './types';

/**
 * Pure mapping: Tautulli history rows → one contribution per plexRatingKey,
 * with play count (row count) and the most-recent played_at.
 */
export function mapTautulliHistory(history: TautulliHistoryItem[]): EnrichmentContribution[] {
  const playCount = new Map<string, number>();
  const lastPlayed = new Map<string, number>();
  for (const item of history) {
    playCount.set(item.rating_key, (playCount.get(item.rating_key) ?? 0) + 1);
    if (item.played_at !== undefined) {
      const current = lastPlayed.get(item.rating_key) ?? 0;
      if (item.played_at > current) lastPlayed.set(item.rating_key, item.played_at);
    }
  }
  return [...playCount.keys()].map((plexRatingKey) => ({
    key: { plexRatingKey },
    values: {
      tautulliPlayCount: playCount.get(plexRatingKey) ?? 0,
      tautulliLastPlayed: lastPlayed.get(plexRatingKey) ?? null,
    },
  }));
}

/**
 * Pure mapping: Plex library items → one contribution per ratingKey,
 * with view count and last-viewed timestamp.
 */
export function mapPlexItems(items: PlexMediaItem[]): EnrichmentContribution[] {
  return items.map((item) => ({
    key: { plexRatingKey: item.ratingKey },
    values: {
      plexViewCount: item.viewCount ?? null,
      plexLastViewedAt: item.lastViewedAt ?? null,
    },
  }));
}

/**
 * Pure mapping: Overseerr requests + issues → contributions keyed by tmdbId.
 * Emits only positive knowledge — request status where a request exists, and
 * overseerrHasIssue=true where an open issue exists.
 */
export function mapOverseerr(
  requests: OverseerrRequest[],
  issues: OverseerrIssue[]
): EnrichmentContribution[] {
  const byTmdbId = new Map<number, EnrichmentContribution>();
  const get = (tmdbId: number): EnrichmentContribution => {
    let c = byTmdbId.get(tmdbId);
    if (!c) {
      c = { key: { tmdbId }, values: {} };
      byTmdbId.set(tmdbId, c);
    }
    return c;
  };
  for (const req of requests) get(req.media.tmdbId).values.overseerrRequestStatus = req.status;
  for (const issue of issues) get(issue.media.tmdbId).values.overseerrHasIssue = true;
  return [...byTmdbId.values()];
}
