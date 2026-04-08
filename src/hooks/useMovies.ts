import { useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';
import type { MediaImage } from './useMedia';

export type { MediaImage };

export interface ManagedMovie {
  id: number;
  title: string;
  year?: number;
  hasFile: boolean;
  monitored: boolean;
  tmdbId: number;
  images?: MediaImage[];
}

export interface MediaFilters {
  [key: string]: string | number | boolean | undefined;
}

interface PaginatedPage {
  items: ManagedMovie[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 48;

async function fetcher(url: string): Promise<PaginatedPage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch movies');
  const json = await res.json();
  return json.data as PaginatedPage;
}

export function useMovies(filters?: MediaFilters) {
  const filtersKey = JSON.stringify(filters ?? null);

  const getKey = (pageIndex: number, prev: PaginatedPage | null) => {
    if (prev && prev.items.length === 0) return null;
    const params = new URLSearchParams({ page: String(pageIndex + 1), pageSize: String(PAGE_SIZE) });
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined) params.set(k, String(v));
      }
    }
    return `/api/media/movies?${params}`;
  };

  const { data, isLoading, isValidating, setSize, error } = useSWRInfinite(getKey, fetcher);

  // Reset to page 1 when filters change
  useEffect(() => {
    void setSize(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const items = data ? data.flatMap((page) => page.items) : [];
  const totalCount = data?.[0]?.totalCount ?? 0;

  return {
    items,
    totalCount,
    isLoading,
    isFetchingMore: isValidating && !isLoading,
    hasMore: items.length < totalCount,
    fetchMore: () => setSize((s) => s + 1),
    error: error as Error | undefined,
  };
}
