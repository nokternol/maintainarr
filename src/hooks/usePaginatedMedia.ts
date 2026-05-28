import type { MediaFilters } from '@app/types/media';
import { useCallback, useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';

interface YearRange {
  min: number | null;
  max: number | null;
}

interface PaginatedPage<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  yearRange?: YearRange;
}

const PAGE_SIZE = 48;

export function usePaginatedMedia<T>(endpoint: string, filters?: MediaFilters) {
  const filtersKey = JSON.stringify(filters ?? null);

  const getKey = (pageIndex: number, prev: PaginatedPage<T> | null) => {
    if (prev && prev.items.length === 0) return null;
    const params = new URLSearchParams({
      page: String(pageIndex + 1),
      pageSize: String(PAGE_SIZE),
    });
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined) params.set(k, String(v));
      }
    }
    return `${endpoint}?${params}`;
  };

  const { data, isLoading, isValidating, setSize, error } = useSWRInfinite<PaginatedPage<T>>(
    getKey,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
      const json = await res.json();
      return json.data as PaginatedPage<T>;
    }
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: filtersKey is a deliberate trigger dep, not consumed inside the effect
  useEffect(() => {
    void setSize(1);
  }, [filtersKey, setSize]);

  const items = data ? data.flatMap((page) => page.items) : [];
  const totalCount = data?.[0]?.totalCount ?? 0;
  const yearRange = data?.[0]?.yearRange ?? null;

  return {
    items,
    totalCount,
    yearRange,
    isLoading,
    isFetchingMore: isValidating && !isLoading,
    hasMore: items.length < totalCount,
    fetchMore: useCallback(() => setSize((s) => s + 1), [setSize]),
    error: error as Error | undefined,
  };
}
