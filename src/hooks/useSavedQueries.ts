import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { FILTER_FIELDS } from './useMediaFilters';
import type { FilterState } from './useMediaFilters';

export type QueryFilters = Omit<FilterState, 'movieSort' | 'seriesSort'>;

export interface SavedQuery {
  id: string;
  name: string;
  filters: QueryFilters;
  createdAt: number;
}

const STORAGE_KEY = 'warden:saved-queries';
const EMPTY: SavedQuery[] = [];

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
  const [queries, setQueries] = useLocalStorage<SavedQuery[]>(STORAGE_KEY, EMPTY);

  const save = useCallback(
    (name: string, filterState: FilterState): SavedQuery => {
      const next: SavedQuery = {
        id: crypto.randomUUID(),
        name: name.trim(),
        filters: stripSortFields(filterState),
        createdAt: Date.now(),
      };
      setQueries([...queries, next]);
      return next;
    },
    [queries, setQueries]
  );

  const remove = useCallback(
    (id: string) => {
      setQueries(queries.filter((q) => q.id !== id));
    },
    [queries, setQueries]
  );

  return { queries, save, remove };
}
