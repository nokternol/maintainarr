import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMedia } from '../useMedia';

describe('useMedia', () => {
  it('returns expected interface', () => {
    const { result } = renderHook(() => useMedia());

    expect(typeof result.current.isLoading).toBe('boolean');
    expect(result.current.error === undefined || result.current.error instanceof Error).toBe(true);
  });

  it('loads movies and series on mount', async () => {
    const { result } = renderHook(() => useMedia());

    await waitFor(() => {
      expect(result.current.movies).toBeDefined();
    });

    expect(Array.isArray(result.current.movies)).toBe(true);
    expect(Array.isArray(result.current.series)).toBe(true);
    expect(result.current.movies?.[0]).toHaveProperty('title', 'The Matrix');
    expect(result.current.series?.[0]).toHaveProperty('title', 'Breaking Bad');
  });

  it('exposes errors array', async () => {
    const { result } = renderHook(() => useMedia());

    await waitFor(() => {
      expect(result.current.movies).toBeDefined();
    });

    expect(Array.isArray(result.current.errors)).toBe(true);
  });
});
