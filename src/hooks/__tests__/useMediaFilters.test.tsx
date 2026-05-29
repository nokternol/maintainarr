/**
 * useMediaFilters — Cycle 4 RED
 *
 * Tests filter state management, debounce, URL sync, clearAll, isActive,
 * AND the FILTER_FIELDS registry contract (single source of truth).
 * Cycle 4 adds: narrow-type assertions proving FILTER_FIELDS is as-const
 * and FilterState is correctly derived from it.
 *
 * Run: vitest run --project client
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { FILTER_FIELDS, type FilterState, useMediaFilters } from '../useMediaFilters';

// ─── Router mock ───────────────────────────────────────────────────────────────

// vi.hoisted ensures these are defined before module imports so vi.mock can close over them.
const { mockReplace } = vi.hoisted(() => ({
  mockReplace: vi.fn().mockResolvedValue(true),
}));

// Mutable query state for testing URL-read-on-mount behaviour.
// The factory reads this at call time via a getter.
let mockRouterQuery: Record<string, string> = {};

vi.mock('next/router', () => ({
  useRouter: () => ({
    get query() {
      return mockRouterQuery;
    },
    pathname: '/media',
    replace: mockReplace,
    basePath: '',
    route: '/',
    asPath: '/',
    isReady: true,
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRouterQuery = {};
  mockReplace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Filter state ─────────────────────────────────────────────────────────────

describe('useMediaFilters — initial state', () => {
  it('starts with all fields empty when router.query is empty', () => {
    const { result } = renderHook(() => useMediaFilters());

    expect(result.current.filterState.title).toBe('');
    expect(result.current.filterState.hasFile).toBeUndefined();
    expect(result.current.filterState.monitored).toBeUndefined();
    expect(result.current.filterState.seriesStatus).toBeUndefined();
    expect(result.current.filterState.yearMin).toBeUndefined();
    expect(result.current.filterState.yearMax).toBeUndefined();
    expect(result.current.filterState.movieTagIds).toBeUndefined();
    expect(result.current.filterState.seriesTagIds).toBeUndefined();
    expect(result.current.filterState.movieQualityProfileIds).toBeUndefined();
    expect(result.current.filterState.seriesQualityProfileIds).toBeUndefined();
  });

  it('reads title from router.query on mount', () => {
    mockRouterQuery = { title: 'batman' };
    const { result } = renderHook(() => useMediaFilters());

    expect(result.current.filterState.title).toBe('batman');
  });

  it('reads hasFile from router.query on mount', () => {
    mockRouterQuery = { hasFile: 'true' };
    const { result } = renderHook(() => useMediaFilters());

    expect(result.current.filterState.hasFile).toBe('true');
  });

  it('reads yearMin and yearMax from router.query on mount', () => {
    mockRouterQuery = { yearMin: '2010', yearMax: '2020' };
    const { result } = renderHook(() => useMediaFilters());

    expect(result.current.filterState.yearMin).toBe(2010);
    expect(result.current.filterState.yearMax).toBe(2020);
  });
});

// ─── Setters ──────────────────────────────────────────────────────────────────

describe('useMediaFilters — setters', () => {
  it('setTitle updates filterState.title immediately', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('matrix');
    });

    expect(result.current.filterState.title).toBe('matrix');
  });

  it('setHasFile updates filterState.hasFile immediately', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setHasFile('true');
    });

    expect(result.current.filterState.hasFile).toBe('true');
  });

  it('setHasFile(undefined) clears the field', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setHasFile('true');
    });
    act(() => {
      result.current.setHasFile(undefined);
    });

    expect(result.current.filterState.hasFile).toBeUndefined();
  });

  it('setMonitored updates filterState.monitored', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setMonitored('false');
    });

    expect(result.current.filterState.monitored).toBe('false');
  });

  it('setSeriesStatus updates filterState.seriesStatus', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setSeriesStatus('ended');
    });

    expect(result.current.filterState.seriesStatus).toBe('ended');
  });

  it('setYearMin updates filterState.yearMin', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setYearMin(2010);
    });

    expect(result.current.filterState.yearMin).toBe(2010);
  });

  it('setMovieTagIds updates filterState.movieTagIds', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setMovieTagIds('1,2');
    });

    expect(result.current.filterState.movieTagIds).toBe('1,2');
  });
});

// ─── Debounce ─────────────────────────────────────────────────────────────────

describe('useMediaFilters — debounce on title', () => {
  it('debouncedFilters.title is empty immediately after setTitle', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('batman');
    });

    // filterState updates immediately, but debouncedFilters.title does not
    expect(result.current.filterState.title).toBe('batman');
    expect(result.current.debouncedFilters.title).toBeUndefined();
  });

  it('debouncedFilters.title updates after 300ms', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('batman');
    });

    // Advance timers past the debounce threshold
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedFilters.title).toBe('batman');
  });

  it('debouncedFilters.title coalesces rapid keystrokes into one update', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('b');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setTitle('ba');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setTitle('bat');
    });
    // 300ms after the LAST keystroke
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedFilters.title).toBe('bat');
  });
});

// ─── Non-title filters are immediate in debouncedFilters ─────────────────────

describe('useMediaFilters — non-title filters update debouncedFilters immediately', () => {
  it('setHasFile is reflected in debouncedFilters immediately', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setHasFile('false');
    });

    expect(result.current.debouncedFilters.hasFile).toBe('false');
  });

  it('setYearMin is reflected in debouncedFilters immediately', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setYearMin(2005);
    });

    expect(result.current.debouncedFilters.yearMin).toBe(2005);
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe('useMediaFilters — clearAll', () => {
  it('resets all filter state to empty', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('matrix');
      result.current.setHasFile('true');
      result.current.setYearMin(2005);
      result.current.setMovieTagIds('1,2');
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.filterState.title).toBe('');
    expect(result.current.filterState.hasFile).toBeUndefined();
    expect(result.current.filterState.yearMin).toBeUndefined();
    expect(result.current.filterState.movieTagIds).toBeUndefined();
  });
});

// ─── isActive ─────────────────────────────────────────────────────────────────

describe('useMediaFilters — isActive', () => {
  it('is false when no filters are set', () => {
    const { result } = renderHook(() => useMediaFilters());
    expect(result.current.isActive).toBe(false);
  });

  it('is true when title is set', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('batman');
    });

    expect(result.current.isActive).toBe(true);
  });

  it('is true when hasFile is set', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setHasFile('true');
    });

    expect(result.current.isActive).toBe(true);
  });

  it('becomes false again after clearAll', () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('matrix');
    });
    act(() => {
      result.current.clearAll();
    });

    expect(result.current.isActive).toBe(false);
  });
});

// ─── URL sync ─────────────────────────────────────────────────────────────────

describe('useMediaFilters — URL sync', () => {
  it('does NOT call router.replace on initial mount', async () => {
    renderHook(() => useMediaFilters());

    // Allow any effects to flush
    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('calls router.replace with shallow=true when a filter changes', async () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setHasFile('true');
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ hasFile: 'true' }) }),
        undefined,
        { shallow: true }
      );
    });
  });

  it('omits undefined fields from the URL query', async () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setHasFile('true');
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });

    const callArgs = mockReplace.mock.calls[0][0];
    // Only hasFile should be in the query — no undefined keys
    expect(Object.keys(callArgs.query)).toEqual(['hasFile']);
  });

  it('clears URL params when clearAll is called', async () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setHasFile('true');
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    mockReplace.mockClear();

    act(() => {
      result.current.clearAll();
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ query: {} }), undefined, {
        shallow: true,
      });
    });
  });
});

// ─── FILTER_FIELDS registry — shape contract ──────────────────────────────────

describe('FILTER_FIELDS registry — shape', () => {
  it('is exported from the module', () => {
    expect(FILTER_FIELDS).toBeDefined();
  });

  it('covers all 15 FilterState fields', () => {
    expect(Object.keys(FILTER_FIELDS).sort()).toEqual([
      'hasFile',
      'monitored',
      'movieGenres',
      'movieQualityProfileIds',
      'movieTagIds',
      'network',
      'seriesGenres',
      'seriesQualityProfileIds',
      'seriesStatus',
      'seriesTagIds',
      'seriesType',
      'tautulliWatched',
      'title',
      'yearMax',
      'yearMin',
    ]);
  });

  it('title is a string field with empty-string default', () => {
    expect(FILTER_FIELDS.title).toEqual({ type: 'string', default: '' });
  });

  it('yearMin and yearMax are number fields with undefined default', () => {
    expect(FILTER_FIELDS.yearMin).toEqual({ type: 'number', default: undefined });
    expect(FILTER_FIELDS.yearMax).toEqual({ type: 'number', default: undefined });
  });

  it('hasFile, monitored, tautulliWatched are bool3 fields with undefined default', () => {
    expect(FILTER_FIELDS.hasFile).toEqual({ type: 'bool3', default: undefined });
    expect(FILTER_FIELDS.monitored).toEqual({ type: 'bool3', default: undefined });
    expect(FILTER_FIELDS.tautulliWatched).toEqual({ type: 'bool3', default: undefined });
  });

  it('remaining string fields have undefined default', () => {
    const stringOptionalKeys = [
      'seriesStatus',
      'movieTagIds',
      'seriesTagIds',
      'movieQualityProfileIds',
      'seriesQualityProfileIds',
      'movieGenres',
      'seriesGenres',
      'seriesType',
      'network',
    ] as const;
    for (const key of stringOptionalKeys) {
      expect(FILTER_FIELDS[key]).toEqual({ type: 'string', default: undefined });
    }
  });
});

// ─── Complete round-trips (all 15 fields) ─────────────────────────────────────

describe('parseQuery — complete round-trip for all 15 fields', () => {
  it('parses all 15 registry fields from query', () => {
    mockRouterQuery = {
      title: 'batman',
      hasFile: 'true',
      monitored: 'false',
      seriesStatus: 'ended',
      yearMin: '2000',
      yearMax: '2020',
      movieTagIds: '1,2',
      seriesTagIds: '3,4',
      movieQualityProfileIds: '5',
      seriesQualityProfileIds: '6',
      movieGenres: 'Action',
      seriesGenres: 'Drama',
      seriesType: 'standard',
      network: 'HBO',
      tautulliWatched: 'false',
    };
    const { result } = renderHook(() => useMediaFilters());

    expect(result.current.filterState).toMatchObject({
      title: 'batman',
      hasFile: 'true',
      monitored: 'false',
      seriesStatus: 'ended',
      yearMin: 2000,
      yearMax: 2020,
      movieTagIds: '1,2',
      seriesTagIds: '3,4',
      movieQualityProfileIds: '5',
      seriesQualityProfileIds: '6',
      movieGenres: 'Action',
      seriesGenres: 'Drama',
      seriesType: 'standard',
      network: 'HBO',
      tautulliWatched: 'false',
    });
  });

  it('applies registry defaults for every absent key', () => {
    mockRouterQuery = {};
    const { result } = renderHook(() => useMediaFilters());

    expect(result.current.filterState).toEqual({
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
    });
  });
});

describe('buildQuery — serializes all 15 non-default fields', () => {
  it('includes every set filter key in the URL query', async () => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      result.current.setTitle('batman');
      result.current.setHasFile('true');
      result.current.setMonitored('false');
      result.current.setSeriesStatus('ended');
      result.current.setYearMin(2000);
      result.current.setYearMax(2020);
      result.current.setMovieTagIds('1,2');
      result.current.setSeriesTagIds('3,4');
      result.current.setMovieQualityProfileIds('5');
      result.current.setSeriesQualityProfileIds('6');
      result.current.setMovieGenres('Action');
      result.current.setSeriesGenres('Drama');
      result.current.setSeriesType('standard');
      result.current.setNetwork('HBO');
      result.current.setTautulliWatched('false');
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const query = mockReplace.mock.calls[0][0].query as Record<string, string>;

    expect(Object.keys(query).sort()).toEqual([
      'hasFile',
      'monitored',
      'movieGenres',
      'movieQualityProfileIds',
      'movieTagIds',
      'network',
      'seriesGenres',
      'seriesQualityProfileIds',
      'seriesStatus',
      'seriesTagIds',
      'seriesType',
      'tautulliWatched',
      'title',
      'yearMax',
      'yearMin',
    ]);
  });
});

describe('isActive — fields not covered by earlier tests', () => {
  it.each([
    ['monitored', 'setMonitored', 'false' as const],
    ['seriesStatus', 'setSeriesStatus', 'ended'],
    ['yearMax', 'setYearMax', 2020],
    ['seriesTagIds', 'setSeriesTagIds', '3,4'],
    ['movieQualityProfileIds', 'setMovieQualityProfileIds', '5'],
    ['seriesQualityProfileIds', 'setSeriesQualityProfileIds', '6'],
    ['movieGenres', 'setMovieGenres', 'Action'],
    ['seriesGenres', 'setSeriesGenres', 'Drama'],
    ['seriesType', 'setSeriesType', 'standard'],
    ['network', 'setNetwork', 'HBO'],
    ['tautulliWatched', 'setTautulliWatched', 'false' as const],
  ])('isActive is true when only %s is set', (_field, setter, value) => {
    const { result } = renderHook(() => useMediaFilters());

    act(() => {
      (result.current[setter as keyof typeof result.current] as (v: unknown) => void)(value);
    });

    expect(result.current.isActive).toBe(true);
  });
});

// ─── Cycle 4 RED: as-const narrow types ───────────────────────────────────────
//
// These tests FAIL while FILTER_FIELDS is annotated as
// `Record<keyof FilterState, FieldSpec>`, because that annotation widens
// every entry to the FieldSpec union and erases the literal types.
// They PASS once FILTER_FIELDS is changed to `as const satisfies`.

describe('FILTER_FIELDS — as-const narrow type preservation', () => {
  it('title.type is narrowly typed as "string" literal', () => {
    expectTypeOf(FILTER_FIELDS.title.type).toEqualTypeOf<'string'>();
  });

  it('yearMin.type is narrowly typed as "number" literal', () => {
    expectTypeOf(FILTER_FIELDS.yearMin.type).toEqualTypeOf<'number'>();
  });

  it('hasFile.type is narrowly typed as "bool3" literal', () => {
    expectTypeOf(FILTER_FIELDS.hasFile.type).toEqualTypeOf<'bool3'>();
  });

  it('title.default is narrowly typed as "" (empty string literal)', () => {
    expectTypeOf(FILTER_FIELDS.title.default).toEqualTypeOf<''>();
  });

  it('yearMin.default is narrowly typed as undefined', () => {
    expectTypeOf(FILTER_FIELDS.yearMin.default).toEqualTypeOf<undefined>();
  });
});

// ─── Cycle 4: FilterState type contract ───────────────────────────────────────
//
// These pass with both the old interface and the new derived type, but act as
// regression guards: if InferValue is wrong during GREEN they will catch it.

describe('FilterState — type derivation contract', () => {
  it('title is typed as string (never undefined)', () => {
    expectTypeOf<FilterState['title']>().toEqualTypeOf<string>();
  });

  it('yearMin is typed as number | undefined', () => {
    expectTypeOf<FilterState['yearMin']>().toEqualTypeOf<number | undefined>();
  });

  it('hasFile is typed as "true" | "false" | undefined', () => {
    expectTypeOf<FilterState['hasFile']>().toEqualTypeOf<'true' | 'false' | undefined>();
  });

  it('seriesStatus is typed as string | undefined', () => {
    expectTypeOf<FilterState['seriesStatus']>().toEqualTypeOf<string | undefined>();
  });
});
