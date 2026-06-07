import type {
  ContentTypeSchema,
  FilterValueEntrySchema,
  FilterValueSchema,
  QueryHealthSchema,
  SavedQuerySchema,
} from '@app/lib/api/schemas';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import type { z } from 'zod';
import { FILTER_FIELDS } from './useMediaFilters';
import type { FilterState } from './useMediaFilters';

export type ContentType = z.infer<typeof ContentTypeSchema>;
export type FilterValue = z.infer<typeof FilterValueSchema>;
export type FilterValueEntry = z.infer<typeof FilterValueEntrySchema>;
export type QueryHealth = z.infer<typeof QueryHealthSchema>;
export type SavedQuery = z.infer<typeof SavedQuerySchema>;

// Translation from FilterState keys to registry keys
const KEY_RENAMES: Partial<Record<string, string>> = {
  tautulliWatched: 'watched',
  movieTagIds: 'tagIds',
  movieQualityProfileIds: 'qualityProfileIds',
  movieGenres: 'genres',
  radarrImdbRatingGte: 'imdbRatingGte',
  radarrImdbRatingLte: 'imdbRatingLte',
  seriesTagIds: 'tagIds',
  seriesQualityProfileIds: 'qualityProfileIds',
  seriesGenres: 'genres',
  sonarrRatingGte: 'communityRatingGte',
  sonarrRatingLte: 'communityRatingLte',
  sonarrEnded: 'ended',
  sonarrLastAiredDaysAgoGte: 'lastAiredDaysAgoGte',
  sonarrLastAiredDaysAgoLte: 'lastAiredDaysAgoLte',
  sonarrPercentEpisodesGte: 'episodePercentageGte',
  sonarrPercentEpisodesLte: 'episodePercentageLte',
};

const SORT_KEYS = new Set(['movieSort', 'seriesSort']);

export function toFilterValues(filterState: FilterState): FilterValueEntry[] {
  const entries: FilterValueEntry[] = [];
  for (const [rawKey, value] of Object.entries(filterState)) {
    if (SORT_KEYS.has(rawKey)) continue;
    const spec = FILTER_FIELDS[rawKey as keyof typeof FILTER_FIELDS];
    if (value === undefined || value === spec?.default) continue;
    const key = KEY_RENAMES[rawKey] ?? rawKey;
    entries.push({ key, value: value as FilterValue });
  }
  return entries;
}

export function buildQueryParams(filterState: FilterState): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filterState)) {
    const spec = FILTER_FIELDS[k as keyof typeof FILTER_FIELDS];
    if (v !== undefined && spec && v !== spec.default) {
      params.set(k, String(v));
    }
  }
  return params.toString();
}

const KEY = '/api/saved-queries';

async function fetchQueries(url: string): Promise<SavedQuery[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch saved queries');
  const json = (await res.json()) as { data: SavedQuery[] };
  return json.data;
}

async function createQuery(
  _key: string,
  { arg }: { arg: { name: string; contentType: ContentType; filterValues: FilterValueEntry[] } }
): Promise<SavedQuery> {
  const res = await fetch(KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) throw new Error('Failed to save query');
  const json = (await res.json()) as { data: SavedQuery };
  return json.data;
}

async function deleteQuery(_key: string, { arg }: { arg: number }): Promise<void> {
  const res = await fetch(`${KEY}/${arg}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete query');
}

export function useSavedQueries() {
  const { data: queries = [], isLoading, mutate } = useSWR(KEY, fetchQueries);

  const { trigger: triggerCreate } = useSWRMutation(KEY, createQuery);
  const { trigger: triggerDelete } = useSWRMutation(KEY, deleteQuery);

  const save = async (
    name: string,
    contentType: ContentType,
    filterState: FilterState
  ): Promise<SavedQuery> => {
    const filterValues = toFilterValues(filterState);
    const q = await triggerCreate({ name, contentType, filterValues });
    await mutate();
    return q!;
  };

  const remove = async (id: number): Promise<void> => {
    await triggerDelete(id);
    await mutate();
  };

  return { queries, isLoading, save, remove };
}
