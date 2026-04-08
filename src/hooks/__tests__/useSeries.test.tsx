import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import { useSeries } from '../useSeries';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('useSeries', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => useSeries(), { wrapper });

    expect(typeof result.current.isLoading).toBe('boolean');
    expect(typeof result.current.isFetchingMore).toBe('boolean');
    expect(typeof result.current.hasMore).toBe('boolean');
    expect(typeof result.current.fetchMore).toBe('function');
    expect(result.current.error === undefined || result.current.error instanceof Error).toBe(true);
    expect(Array.isArray(result.current.items)).toBe(true);
    expect(typeof result.current.totalCount).toBe('number');
  });

  it('isLoading is true before first page resolves', () => {
    const { result } = renderHook(() => useSeries(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads first page on mount', async () => {
    const { result } = renderHook(() => useSeries(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items.length).toBe(10);
    expect(result.current.totalCount).toBe(10);
    expect(result.current.items[0]).toHaveProperty('title', 'Breaking Bad');
  });

  it('hasMore is false when all series fit in one page', async () => {
    const { result } = renderHook(() => useSeries(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasMore).toBe(false); // 10 loaded === 10 total
  });
});
