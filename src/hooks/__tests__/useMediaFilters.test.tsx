/**
 * useMediaFilters — Cycle 2 RED
 *
 * Tests filter state management, debounce, URL sync, clearAll, and isActive.
 *
 * Run: vitest run --project client
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaFilters } from '../useMediaFilters';

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
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({ query: {} }),
        undefined,
        { shallow: true }
      );
    });
  });
});
