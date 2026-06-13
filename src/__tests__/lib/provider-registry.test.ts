import { getProviderEntry, getProviderOrder, getProviderTypes } from '@app/lib/provider-registry';
import { describe, expect, it } from 'vitest';

describe('getProviderEntry', () => {
  it('returns RADARR entry with correct apiSuffix, order, filterCapabilities, and first task id', () => {
    const entry = getProviderEntry('RADARR');

    expect(entry).toBeDefined();
    expect(entry!.apiSuffix).toBe('/api/v3');
    expect(entry!.order).toBe(2);
    expect(entry!.filterCapabilities).toContain('Movie library');
    expect(entry!.tasks[0].id).toBe('deleteMovieWithFiles');
  });

  it('returns SONARR entry with deleteSeriesWithFiles task marked destructive', () => {
    const entry = getProviderEntry('SONARR');

    expect(entry).toBeDefined();
    const task = entry!.tasks.find((t) => t.id === 'deleteSeriesWithFiles');
    expect(task).toBeDefined();
    expect(task!.destructive).toBe(true);
  });

  it('returns TMDB entry with correct defaultUrl and empty apiSuffix', () => {
    const entry = getProviderEntry('TMDB');

    expect(entry).toBeDefined();
    expect(entry!.defaultUrl).toBe('https://api.themoviedb.org/3');
    expect(entry!.apiSuffix).toBe('');
  });

  it('returns PLEX entry with empty apiSuffix and undefined defaultUrl', () => {
    const entry = getProviderEntry('PLEX');

    expect(entry).toBeDefined();
    expect(entry!.apiSuffix).toBe('');
    expect(entry!.defaultUrl).toBeUndefined();
  });

  it('returns OVERSEERR entry with filterCapabilities containing only "Request queue"', () => {
    const entry = getProviderEntry('OVERSEERR');

    expect(entry).toBeDefined();
    expect(entry!.filterCapabilities).toEqual(['Request queue']);
  });
});

describe('getProviderOrder', () => {
  it('returns all 8 providers in the correct defined order', () => {
    const order = getProviderOrder();

    expect(order).toEqual([
      'PLEX',
      'JELLYFIN',
      'RADARR',
      'SONARR',
      'TAUTULLI',
      'OVERSEERR',
      'TMDB',
      'OMDB',
    ]);
  });
});

describe('getProviderTypes', () => {
  it('has length 8 and includes all 8 provider keys', () => {
    const types = getProviderTypes();

    expect(types).toHaveLength(8);
    expect(types).toContain('PLEX');
    expect(types).toContain('JELLYFIN');
    expect(types).toContain('RADARR');
    expect(types).toContain('SONARR');
    expect(types).toContain('TAUTULLI');
    expect(types).toContain('OVERSEERR');
    expect(types).toContain('TMDB');
    expect(types).toContain('OMDB');
  });
});

describe('getProviderEntry — unknown type', () => {
  it('returns undefined for an unrecognised provider type', () => {
    const entry = getProviderEntry('UNKNOWN');

    expect(entry).toBeUndefined();
  });
});

describe('PROVIDER_TASKS backward compat (tasks.ts re-export)', () => {
  it('PROVIDER_TASKS["RADARR"] still returns the same tasks as the registry', async () => {
    const { PROVIDER_TASKS } = await import('@app/lib/tasks');
    const registryEntry = getProviderEntry('RADARR');

    expect(PROVIDER_TASKS.RADARR).toBeDefined();
    expect(PROVIDER_TASKS.RADARR).toEqual(registryEntry!.tasks);
  });
});
