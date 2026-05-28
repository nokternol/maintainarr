import type { MediaFilters } from '@app/types/media';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

const DEBOUNCE_MS = 300;

export interface FilterState {
  title: string;
  hasFile: 'true' | 'false' | undefined;
  monitored: 'true' | 'false' | undefined;
  seriesStatus: string | undefined;
  yearMin: number | undefined;
  yearMax: number | undefined;
  movieTagIds: string | undefined;
  seriesTagIds: string | undefined;
  movieQualityProfileIds: string | undefined;
  seriesQualityProfileIds: string | undefined;
  movieGenres: string | undefined;
  seriesGenres: string | undefined;
  seriesType: string | undefined;
  network: string | undefined;
  tautulliWatched: 'true' | 'false' | undefined;
}

type FieldSpec =
  | { type: 'string'; default: string | undefined }
  | { type: 'number'; default: number | undefined }
  | { type: 'bool3'; default: 'true' | 'false' | undefined };

export const FILTER_FIELDS: Record<keyof FilterState, FieldSpec> = {
  title: { type: 'string', default: '' },
  hasFile: { type: 'bool3', default: undefined },
  monitored: { type: 'bool3', default: undefined },
  seriesStatus: { type: 'string', default: undefined },
  yearMin: { type: 'number', default: undefined },
  yearMax: { type: 'number', default: undefined },
  movieTagIds: { type: 'string', default: undefined },
  seriesTagIds: { type: 'string', default: undefined },
  movieQualityProfileIds: { type: 'string', default: undefined },
  seriesQualityProfileIds: { type: 'string', default: undefined },
  movieGenres: { type: 'string', default: undefined },
  seriesGenres: { type: 'string', default: undefined },
  seriesType: { type: 'string', default: undefined },
  network: { type: 'string', default: undefined },
  tautulliWatched: { type: 'bool3', default: undefined },
};

const EMPTY_FILTER_STATE = Object.fromEntries(
  Object.entries(FILTER_FIELDS).map(([key, spec]) => [key, spec.default])
) as unknown as FilterState;

function parseQuery(query: Record<string, string | string[] | undefined>): FilterState {
  const state = { ...EMPTY_FILTER_STATE };
  for (const [key, spec] of Object.entries(FILTER_FIELDS)) {
    const raw = query[key];
    const v = typeof raw === 'string' ? raw : undefined;
    if (v === undefined) continue;
    if (spec.type === 'number') {
      const n = Number(v);
      (state as unknown as Record<string, unknown>)[key] = Number.isNaN(n) ? spec.default : n;
    } else {
      (state as unknown as Record<string, unknown>)[key] = v;
    }
  }
  return state;
}

function buildQuery(state: FilterState): Record<string, string> {
  const q: Record<string, string> = {};
  for (const [key, spec] of Object.entries(FILTER_FIELDS)) {
    const value = (state as unknown as Record<string, unknown>)[key];
    if (value !== undefined && value !== spec.default) {
      q[key] = String(value);
    }
  }
  return q;
}

function isAnyFilterActive(state: FilterState): boolean {
  return Object.entries(FILTER_FIELDS).some(([key, spec]) => {
    return (state as unknown as Record<string, unknown>)[key] !== spec.default;
  });
}

export function useMediaFilters() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [filterState, setFilterState] = useState<FilterState>(() => parseQuery(router.query));

  const [debouncedTitle, setDebouncedTitle] = useState(filterState.title);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTitle(filterState.title);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterState.title]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const r = routerRef.current;
    void r.replace({ pathname: r.pathname, query: buildQuery(filterState) }, undefined, {
      shallow: true,
    });
  }, [filterState]);

  const debouncedFilters: MediaFilters = useMemo(() => {
    const f: MediaFilters = {};
    for (const [key, spec] of Object.entries(FILTER_FIELDS)) {
      if (key === 'title') {
        if (debouncedTitle) f.title = debouncedTitle;
      } else {
        const value = (filterState as unknown as Record<string, unknown>)[key];
        if (value !== undefined && value !== spec.default) {
          f[key] = value as string | number;
        }
      }
    }
    return f;
  }, [debouncedTitle, filterState]);

  const isActive = isAnyFilterActive(filterState);

  return {
    filterState,
    debouncedFilters,
    setTitle: (v: string) => setFilterState((s) => ({ ...s, title: v })),
    setHasFile: (v: 'true' | 'false' | undefined) => setFilterState((s) => ({ ...s, hasFile: v })),
    setMonitored: (v: 'true' | 'false' | undefined) =>
      setFilterState((s) => ({ ...s, monitored: v })),
    setSeriesStatus: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesStatus: v })),
    setYearMin: (v: number | undefined) => setFilterState((s) => ({ ...s, yearMin: v })),
    setYearMax: (v: number | undefined) => setFilterState((s) => ({ ...s, yearMax: v })),
    setMovieTagIds: (v: string | undefined) => setFilterState((s) => ({ ...s, movieTagIds: v })),
    setSeriesTagIds: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesTagIds: v })),
    setMovieQualityProfileIds: (v: string | undefined) =>
      setFilterState((s) => ({ ...s, movieQualityProfileIds: v })),
    setSeriesQualityProfileIds: (v: string | undefined) =>
      setFilterState((s) => ({ ...s, seriesQualityProfileIds: v })),
    setMovieGenres: (v: string | undefined) => setFilterState((s) => ({ ...s, movieGenres: v })),
    setSeriesGenres: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesGenres: v })),
    setSeriesType: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesType: v })),
    setNetwork: (v: string | undefined) => setFilterState((s) => ({ ...s, network: v })),
    setTautulliWatched: (v: 'true' | 'false' | undefined) =>
      setFilterState((s) => ({ ...s, tautulliWatched: v })),
    clearAll: () => setFilterState(EMPTY_FILTER_STATE),
    isActive,
  };
}
