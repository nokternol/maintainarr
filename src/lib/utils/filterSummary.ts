import type { QueryFilters } from '@app/hooks/useSavedQueries';

export function summarizeFilters(filters: QueryFilters): string[] {
  const parts: string[] = [];

  if (filters.title) parts.push(`"${filters.title}"`);
  if (filters.hasFile === 'true') parts.push('Downloaded');
  if (filters.hasFile === 'false') parts.push('Missing');
  if (filters.monitored === 'true') parts.push('Monitored');
  if (filters.monitored === 'false') parts.push('Unmonitored');

  if (filters.seriesStatus) {
    const map: Record<string, string> = { continuing: 'Continuing', ended: 'Ended' };
    parts.push(map[filters.seriesStatus] ?? filters.seriesStatus);
  }

  if (filters.seriesType) {
    const map: Record<string, string> = { anime: 'Anime', daily: 'Daily', standard: 'Standard' };
    parts.push(map[filters.seriesType] ?? filters.seriesType);
  }

  if (filters.tautulliWatched === 'true') parts.push('Watched');
  if (filters.tautulliWatched === 'false') parts.push('Unwatched');

  if (filters.yearMin !== undefined && filters.yearMax !== undefined) {
    parts.push(`${filters.yearMin}–${filters.yearMax}`);
  } else if (filters.yearMin !== undefined) {
    parts.push(`From ${filters.yearMin}`);
  } else if (filters.yearMax !== undefined) {
    parts.push(`Until ${filters.yearMax}`);
  }

  if (filters.movieGenres) {
    const genres = filters.movieGenres
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (genres.length <= 2) parts.push(genres.join(', '));
    else parts.push(`${genres[0]}, ${genres[1]} +${genres.length - 2}`);
  }

  if (filters.seriesGenres) {
    const genres = filters.seriesGenres
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (genres.length <= 2) parts.push(genres.join(', '));
    else parts.push(`${genres[0]}, ${genres[1]} +${genres.length - 2}`);
  }

  if (filters.network) {
    const networks = filters.network
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (networks.length <= 2) parts.push(networks.join(', '));
    else parts.push(`${networks[0]} +${networks.length - 1}`);
  }

  if (filters.movieTagIds) {
    const count = filters.movieTagIds.split(',').filter(Boolean).length;
    parts.push(count === 1 ? '1 movie tag' : `${count} movie tags`);
  }

  if (filters.seriesTagIds) {
    const count = filters.seriesTagIds.split(',').filter(Boolean).length;
    parts.push(count === 1 ? '1 series tag' : `${count} series tags`);
  }

  if (filters.movieQualityProfileIds) {
    const count = filters.movieQualityProfileIds.split(',').filter(Boolean).length;
    parts.push(count === 1 ? '1 quality profile' : `${count} quality profiles`);
  }

  if (filters.seriesQualityProfileIds) {
    const count = filters.seriesQualityProfileIds.split(',').filter(Boolean).length;
    parts.push(count === 1 ? '1 quality profile' : `${count} quality profiles`);
  }

  return parts;
}
