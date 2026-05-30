import type { MediaFilters } from '@app/types/media';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

const DEBOUNCE_MS = 300;

type FieldSpec =
  | { type: 'string'; default: string | undefined }
  | { type: 'number'; default: number | undefined }
  | { type: 'bool3'; default: 'true' | 'false' | undefined };

type InferValue<S extends FieldSpec> = S extends { type: 'number' }
  ? number | undefined
  : S extends { type: 'bool3' }
    ? 'true' | 'false' | undefined
    : S extends { type: 'string'; default: string }
      ? string
      : string | undefined;

export const FILTER_FIELDS = {
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
  movieSort: { type: 'string', default: 'title_asc' },
  seriesSort: { type: 'string', default: 'title_asc' },
} as const satisfies Record<string, FieldSpec>;

export type FilterState = {
  [K in keyof typeof FILTER_FIELDS]: InferValue<(typeof FILTER_FIELDS)[K]>;
};

// Object.fromEntries loses per-key types; FilterState correctness is enforced
// by the satisfies check above which proves every entry is a valid FieldSpec.
const EMPTY_FILTER_STATE = Object.fromEntries(
  Object.entries(FILTER_FIELDS).map(([key, spec]) => [key, spec.default])
) as FilterState;

type FilterKey = keyof typeof FILTER_FIELDS;

const SORT_KEYS: ReadonlySet<FilterKey> = new Set<FilterKey>(['movieSort', 'seriesSort']);

function parseQuery(query: Record<string, string | string[] | undefined>): FilterState {
  const state = { ...EMPTY_FILTER_STATE };
  for (const k of Object.keys(FILTER_FIELDS) as FilterKey[]) {
    const spec = FILTER_FIELDS[k];
    const raw = query[k];
    const v = typeof raw === 'string' ? raw : undefined;
    if (v === undefined) continue;
    if (spec.type === 'number') {
      const n = Number(v);
      Object.assign(state, { [k]: Number.isNaN(n) ? spec.default : n });
    } else {
      Object.assign(state, { [k]: v });
    }
  }
  return state;
}

function buildQuery(state: FilterState): Record<string, string> {
  const q: Record<string, string> = {};
  for (const k of Object.keys(FILTER_FIELDS) as FilterKey[]) {
    const value = state[k];
    if (value !== undefined && value !== FILTER_FIELDS[k].default) {
      q[k] = String(value);
    }
  }
  return q;
}

function isAnyFilterActive(state: FilterState): boolean {
  return (Object.keys(FILTER_FIELDS) as FilterKey[]).some(
    (k) => !SORT_KEYS.has(k) && state[k] !== FILTER_FIELDS[k].default
  );
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
    for (const k of Object.keys(FILTER_FIELDS) as FilterKey[]) {
      if (SORT_KEYS.has(k)) continue;
      if (k === 'title') {
        if (debouncedTitle) f.title = debouncedTitle;
      } else {
        const value = filterState[k];
        if (value !== undefined && value !== FILTER_FIELDS[k].default) {
          f[k] = value;
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
    setMovieSort: (v: string) => setFilterState((s) => ({ ...s, movieSort: v })),
    setSeriesSort: (v: string) => setFilterState((s) => ({ ...s, seriesSort: v })),
    clearAll: () => setFilterState(EMPTY_FILTER_STATE),
    isActive,
  };
}
