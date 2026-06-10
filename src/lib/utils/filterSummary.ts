import type { FilterValueEntry } from '@app/hooks/useSavedQueries';

const LABELS: Record<string, string> = {
  title: 'Title',
  yearMin: 'Year from',
  yearMax: 'Year until',
  watched: 'Watched',
  addedDaysAgoGte: 'Added ≥ days',
  addedDaysAgoLte: 'Added ≤ days',
  sizeOnDiskGbGte: 'Size ≥ GB',
  sizeOnDiskGbLte: 'Size ≤ GB',
  certification: 'Rating',
  hasFile: 'Has file',
  tagIds: 'Tags',
  qualityProfileIds: 'Quality profiles',
  genres: 'Genres',
  imdbRatingGte: 'IMDB ≥',
  imdbRatingLte: 'IMDB ≤',
  monitored: 'Monitored',
  seriesStatus: 'Status',
  seriesType: 'Series type',
  network: 'Network',
  communityRatingGte: 'Rating ≥',
  communityRatingLte: 'Rating ≤',
  ended: 'Ended',
  lastAiredDaysAgoGte: 'Last aired ≥ days',
  lastAiredDaysAgoLte: 'Last aired ≤ days',
  episodePercentageGte: 'Episodes ≥ %',
  episodePercentageLte: 'Episodes ≤ %',
  tmdbStatus: 'TMDB status',
  overseerrRequestStatus: 'Request status',
  overseerrHasIssue: 'Has issue',
  lastWatchedDaysAgoGte: 'Last watched ≥ days',
  lastWatchedDaysAgoLte: 'Last watched ≤ days',
};

export function summarizeFilters(filterValues: FilterValueEntry[]): string[] {
  return filterValues.map(({ key, value }) => {
    const label = LABELS[key] ?? key;
    if (typeof value === 'boolean') {
      return value ? label : `Not ${label.toLowerCase()}`;
    }
    return `${label}: ${value}`;
  });
}
