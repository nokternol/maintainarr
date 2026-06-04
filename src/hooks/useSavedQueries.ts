import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { FILTER_FIELDS } from './useMediaFilters';
import type { FilterState } from './useMediaFilters';

export type QueryFilters = Omit<FilterState, 'movieSort' | 'seriesSort'>;

export interface SavedQuery {
  id: number;
  name: string;
  filters: QueryFilters;
  createdAt: string;
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
  { arg }: { arg: { name: string; filters: QueryFilters } }
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

function stripSortFields(state: FilterState): QueryFilters {
  const { movieSort: _m, seriesSort: _s, ...rest } = state;
  return rest;
}

export function buildQueryParams(filters: QueryFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    const spec = FILTER_FIELDS[k as keyof typeof FILTER_FIELDS];
    if (v !== undefined && spec && v !== spec.default) {
      params.set(k, String(v));
    }
  }
  return params.toString();
}

export function useSavedQueries() {
  const { data: queries = [], isLoading, mutate } = useSWR(KEY, fetchQueries);

  const { trigger: triggerCreate } = useSWRMutation(KEY, createQuery);
  const { trigger: triggerDelete } = useSWRMutation(KEY, deleteQuery);

  const save = async (name: string, filterState: FilterState): Promise<SavedQuery> => {
    const q = await triggerCreate({ name, filters: stripSortFields(filterState) });
    await mutate();
    return q!;
  };

  const remove = async (id: number): Promise<void> => {
    await triggerDelete(id);
    await mutate();
  };

  return { queries, isLoading, save, remove };
}
