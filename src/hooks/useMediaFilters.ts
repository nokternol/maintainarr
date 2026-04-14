import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MediaFilters } from './useMovies';

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

const EMPTY_FILTER_STATE: FilterState = {
  title: '',
  hasFile: undefined,
  monitored: undefined,
  seriesStatus: undefined,
  yearMin: undefined,
  yearMax: undefined,
  movieTagIds: undefined,
  seriesTagIds: undefined,
  movieQualityProfileIds: undefined,
  seriesQualityProfileIds: undefined,
  movieGenres: undefined,
  seriesGenres: undefined,
  seriesType: undefined,
  network: undefined,
  tautulliWatched: undefined,
};

function parseQuery(query: Record<string, string | string[] | undefined>): FilterState {
  const str = (key: string) => {
    const v = query[key];
    return typeof v === 'string' ? v : undefined;
  };
  const num = (key: string) => {
    const v = str(key);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };

  return {
    title: str('title') ?? '',
    hasFile: str('hasFile') as 'true' | 'false' | undefined,
    monitored: str('monitored') as 'true' | 'false' | undefined,
    seriesStatus: str('seriesStatus'),
    yearMin: num('yearMin'),
    yearMax: num('yearMax'),
    movieTagIds: str('movieTagIds'),
    seriesTagIds: str('seriesTagIds'),
    movieQualityProfileIds: str('movieQualityProfileIds'),
    seriesQualityProfileIds: str('seriesQualityProfileIds'),
    movieGenres: str('movieGenres'),
    seriesGenres: str('seriesGenres'),
    seriesType: str('seriesType'),
    network: str('network'),
    tautulliWatched: str('tautulliWatched') as 'true' | 'false' | undefined,
  };
}

function buildQuery(state: FilterState): Record<string, string> {
  const q: Record<string, string> = {};
  if (state.title) q.title = state.title;
  if (state.hasFile !== undefined) q.hasFile = state.hasFile;
  if (state.monitored !== undefined) q.monitored = state.monitored;
  if (state.seriesStatus !== undefined) q.seriesStatus = state.seriesStatus;
  if (state.yearMin !== undefined) q.yearMin = String(state.yearMin);
  if (state.yearMax !== undefined) q.yearMax = String(state.yearMax);
  if (state.movieTagIds !== undefined) q.movieTagIds = state.movieTagIds;
  if (state.seriesTagIds !== undefined) q.seriesTagIds = state.seriesTagIds;
  if (state.movieQualityProfileIds !== undefined) q.movieQualityProfileIds = state.movieQualityProfileIds;
  if (state.seriesQualityProfileIds !== undefined) q.seriesQualityProfileIds = state.seriesQualityProfileIds;
  if (state.movieGenres !== undefined) q.movieGenres = state.movieGenres;
  if (state.seriesGenres !== undefined) q.seriesGenres = state.seriesGenres;
  if (state.seriesType !== undefined) q.seriesType = state.seriesType;
  if (state.network !== undefined) q.network = state.network;
  if (state.tautulliWatched !== undefined) q.tautulliWatched = state.tautulliWatched;
  return q;
}

function isAnyFilterActive(state: FilterState): boolean {
  return (
    state.title !== '' ||
    state.hasFile !== undefined ||
    state.monitored !== undefined ||
    state.seriesStatus !== undefined ||
    state.yearMin !== undefined ||
    state.yearMax !== undefined ||
    state.movieTagIds !== undefined ||
    state.seriesTagIds !== undefined ||
    state.movieQualityProfileIds !== undefined ||
    state.seriesQualityProfileIds !== undefined ||
    state.movieGenres !== undefined ||
    state.seriesGenres !== undefined ||
    state.seriesType !== undefined ||
    state.network !== undefined ||
    state.tautulliWatched !== undefined
  );
}

export function useMediaFilters() {
  const router = useRouter();

  const [filterState, setFilterState] = useState<FilterState>(() =>
    parseQuery(router.query)
  );

  // Debounced title — only title gets the 300ms delay
  const [debouncedTitle, setDebouncedTitle] = useState(filterState.title);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTitle(filterState.title);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterState.title]);

  // URL sync — skip first render to avoid overwriting existing URL params
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void router.replace(
      { pathname: router.pathname, query: buildQuery(filterState) },
      undefined,
      { shallow: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState]);

  // debouncedFilters is used by the data hooks (useMovies, useSeries)
  const debouncedFilters: MediaFilters = useMemo(() => {
    const f: MediaFilters = {};
    if (debouncedTitle) f.title = debouncedTitle;
    if (filterState.hasFile !== undefined) f.hasFile = filterState.hasFile;
    if (filterState.monitored !== undefined) f.monitored = filterState.monitored;
    if (filterState.seriesStatus !== undefined) f.seriesStatus = filterState.seriesStatus;
    if (filterState.yearMin !== undefined) f.yearMin = filterState.yearMin;
    if (filterState.yearMax !== undefined) f.yearMax = filterState.yearMax;
    if (filterState.movieTagIds !== undefined) f.movieTagIds = filterState.movieTagIds;
    if (filterState.seriesTagIds !== undefined) f.seriesTagIds = filterState.seriesTagIds;
    if (filterState.movieQualityProfileIds !== undefined) f.movieQualityProfileIds = filterState.movieQualityProfileIds;
    if (filterState.seriesQualityProfileIds !== undefined) f.seriesQualityProfileIds = filterState.seriesQualityProfileIds;
    if (filterState.movieGenres !== undefined) f.movieGenres = filterState.movieGenres;
    if (filterState.seriesGenres !== undefined) f.seriesGenres = filterState.seriesGenres;
    if (filterState.seriesType !== undefined) f.seriesType = filterState.seriesType;
    if (filterState.network !== undefined) f.network = filterState.network;
    if (filterState.tautulliWatched !== undefined) f.tautulliWatched = filterState.tautulliWatched;
    return f;
  }, [
    debouncedTitle,
    filterState.hasFile,
    filterState.monitored,
    filterState.seriesStatus,
    filterState.yearMin,
    filterState.yearMax,
    filterState.movieTagIds,
    filterState.seriesTagIds,
    filterState.movieQualityProfileIds,
    filterState.seriesQualityProfileIds,
    filterState.movieGenres,
    filterState.seriesGenres,
    filterState.seriesType,
    filterState.network,
    filterState.tautulliWatched,
  ]);

  const isActive = isAnyFilterActive(filterState);

  return {
    filterState,
    debouncedFilters,
    setTitle: (v: string) => setFilterState((s) => ({ ...s, title: v })),
    setHasFile: (v: 'true' | 'false' | undefined) => setFilterState((s) => ({ ...s, hasFile: v })),
    setMonitored: (v: 'true' | 'false' | undefined) => setFilterState((s) => ({ ...s, monitored: v })),
    setSeriesStatus: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesStatus: v })),
    setYearMin: (v: number | undefined) => setFilterState((s) => ({ ...s, yearMin: v })),
    setYearMax: (v: number | undefined) => setFilterState((s) => ({ ...s, yearMax: v })),
    setMovieTagIds: (v: string | undefined) => setFilterState((s) => ({ ...s, movieTagIds: v })),
    setSeriesTagIds: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesTagIds: v })),
    setMovieQualityProfileIds: (v: string | undefined) => setFilterState((s) => ({ ...s, movieQualityProfileIds: v })),
    setSeriesQualityProfileIds: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesQualityProfileIds: v })),
    setMovieGenres: (v: string | undefined) => setFilterState((s) => ({ ...s, movieGenres: v })),
    setSeriesGenres: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesGenres: v })),
    setSeriesType: (v: string | undefined) => setFilterState((s) => ({ ...s, seriesType: v })),
    setNetwork: (v: string | undefined) => setFilterState((s) => ({ ...s, network: v })),
    setTautulliWatched: (v: 'true' | 'false' | undefined) => setFilterState((s) => ({ ...s, tautulliWatched: v })),
    clearAll: () => setFilterState(EMPTY_FILTER_STATE),
    isActive,
  };
}
