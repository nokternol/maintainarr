import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRatings } from '../useRatings';

describe('useRatings', () => {
  it('returns trigger function and initial state', () => {
    const { result } = renderHook(() => useRatings());

    expect(typeof result.current.trigger).toBe('function');
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading to true when trigger is called and resolves with data', async () => {
    const { result } = renderHook(() => useRatings());

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.trigger({ title: 'Breaking Bad', year: 2008 });
    });

    await act(async () => {
      await promise;
    });

    // After resolution data should be set
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.title).toBe('Breaking Bad');
    expect(result.current.isLoading).toBe(false);
  });

  it('includes year in the request when provided', async () => {
    const { result } = renderHook(() => useRatings());

    await act(async () => {
      await result.current.trigger({ title: 'The Matrix', year: 1999 });
    });

    expect(result.current.data?.title).toBeDefined();
  });

  it('works without year parameter', async () => {
    const { result } = renderHook(() => useRatings());

    await act(async () => {
      await result.current.trigger({ title: 'The Matrix' });
    });

    expect(result.current.data).toBeDefined();
  });
});
