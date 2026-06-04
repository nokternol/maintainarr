/**
 * Utilities for matching media titles against a Tautulli watch-history set.
 *
 * Tautulli's get_history endpoint does not expose external IDs (tmdb_id, tvdb_id),
 * so matching must be title-based. This module normalises titles before comparison
 * to tolerate common variations: leading articles, trailing year suffixes, and
 * inconsistent whitespace.
 */

export function normalizeTitle(title: string): string {
  let s = title.trim().replace(/\s+/g, ' ').toLowerCase();
  s = s.replace(/^(the|a|an) /, '');
  s = s.replace(/ \(\d{4}\)$/, '');
  return s;
}

export function buildWatchedTitleSet(titles: string[]): Set<string> {
  return new Set(titles.map(normalizeTitle));
}

export function isTitleWatched(mediaTitle: string, watchedSet: Set<string>): boolean {
  return watchedSet.has(normalizeTitle(mediaTitle));
}
