import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import { useMediaLookups } from '../useMediaLookups';

// ─── SWR isolation wrapper ────────────────────────────────────────────────────

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useMediaLookups', () => {
  it('returns empty arrays before data loads', () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    expect(result.current.tags.radarr).toEqual([]);
    expect(result.current.tags.sonarr).toEqual([]);
    expect(result.current.qualityProfiles.radarr).toEqual([]);
    expect(result.current.qualityProfiles.sonarr).toEqual([]);
    expect(result.current.genres.movies).toEqual([]);
    expect(result.current.genres.series).toEqual([]);
    expect(result.current.networks).toEqual([]);
  });

  it('loads radarr and sonarr tags', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.tags.radarr.length).toBeGreaterThan(0);
    });

    expect(result.current.tags.radarr[0]).toHaveProperty('id');
    expect(result.current.tags.radarr[0]).toHaveProperty('label');
    expect(result.current.tags.sonarr.length).toBeGreaterThan(0);
  });

  it('loads radarr and sonarr quality profiles', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.qualityProfiles.radarr.length).toBeGreaterThan(0);
    });

    expect(result.current.qualityProfiles.radarr[0]).toHaveProperty('id');
    expect(result.current.qualityProfiles.radarr[0]).toHaveProperty('name');
    expect(result.current.qualityProfiles.sonarr.length).toBeGreaterThan(0);
  });

  it('loads movie and series genres', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.genres.movies.length).toBeGreaterThan(0);
    });

    expect(typeof result.current.genres.movies[0]).toBe('string');
    expect(result.current.genres.series.length).toBeGreaterThan(0);
  });

  it('loads networks', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.networks.length).toBeGreaterThan(0);
    });

    expect(typeof result.current.networks[0]).toBe('string');
  });

  it('loads studio', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.studio.length).toBeGreaterThan(0);
    });

    expect(typeof result.current.studio[0]).toBe('string');
  });

  it('loads release groups', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.releaseGroups.length).toBeGreaterThan(0);
    });

    expect(typeof result.current.releaseGroups[0]).toBe('string');
  });

  it('loads collection names', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.collectionNames.length).toBeGreaterThan(0);
    });

    expect(typeof result.current.collectionNames[0]).toBe('string');
  });

  it('loads a flat array of language profiles', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.languageProfiles.length).toBeGreaterThan(0);
    });

    expect(result.current.languageProfiles[0]).toHaveProperty('id');
    expect(result.current.languageProfiles[0]).toHaveProperty('name');
  });

  it('exposes the correct shape for all fields', async () => {
    const { result } = renderHook(() => useMediaLookups(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.tags.radarr.length).toBeGreaterThan(0);
    });

    const { tags, qualityProfiles, genres, networks } = result.current;

    expect(tags).toHaveProperty('radarr');
    expect(tags).toHaveProperty('sonarr');
    expect(qualityProfiles).toHaveProperty('radarr');
    expect(qualityProfiles).toHaveProperty('sonarr');
    expect(genres).toHaveProperty('movies');
    expect(genres).toHaveProperty('series');
    expect(Array.isArray(networks)).toBe(true);
  });
});
