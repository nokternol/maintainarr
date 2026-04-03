import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useProviderSettings } from '../useProviderSettings';

describe('useProviderSettings', () => {
  it('returns expected interface', () => {
    const { result } = renderHook(() => useProviderSettings());

    expect(typeof result.current.create).toBe('function');
    expect(typeof result.current.update).toBe('function');
    expect(typeof result.current.remove).toBe('function');
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('loads providers list on mount', async () => {
    const { result } = renderHook(() => useProviderSettings());

    await waitFor(() => {
      expect(result.current.providers).toBeDefined();
    });

    expect(Array.isArray(result.current.providers)).toBe(true);
    expect(result.current.providers?.length).toBeGreaterThan(0);
    expect(result.current.providers?.[0]).toHaveProperty('type');
    expect(result.current.providers?.[0]).toHaveProperty('name');
    expect(result.current.providers?.[0]).toHaveProperty('url');
  });

  it('create returns the new provider', async () => {
    const { result } = renderHook(() => useProviderSettings());

    let created: unknown;
    await act(async () => {
      created = await result.current.create({
        type: 'SONARR',
        name: 'Sonarr Main',
        url: 'http://localhost:8989/api/v3',
        apiKey: 'test-key',
      });
    });

    expect(created).toHaveProperty('id');
    expect(created).toHaveProperty('type', 'SONARR');
    expect(created).toHaveProperty('name', 'Sonarr Main');
  });

  it('update returns the patched provider', async () => {
    const { result } = renderHook(() => useProviderSettings());

    let updated: unknown;
    await act(async () => {
      updated = await result.current.update(1, { name: 'Radarr 4K' });
    });

    expect(updated).toHaveProperty('id', 1);
    expect(updated).toHaveProperty('name', 'Radarr 4K');
  });

  it('remove resolves without error', async () => {
    const { result } = renderHook(() => useProviderSettings());

    await act(async () => {
      await result.current.remove(1);
    });
  });
});
