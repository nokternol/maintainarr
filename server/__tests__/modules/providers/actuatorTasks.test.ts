import { getChildLogger } from '@server/kernel/logger';
import { JellyfinProvider } from '@server/modules/providers/connections/jellyfinProvider';
import { PlexProvider } from '@server/modules/providers/connections/plexProvider';
import { RadarrProvider } from '@server/modules/providers/connections/radarrProvider';
import { SonarrProvider } from '@server/modules/providers/connections/sonarrProvider';
import { TautulliProvider } from '@server/modules/providers/connections/tautulliProvider';
import { describe, expect, it } from 'vitest';

const log = getChildLogger('actuator-tasks-test');

const radarrConfig = {
  name: 'Test Radarr',
  url: 'http://localhost:7878/api/v3',
  apiKey: 'test-api-key',
  settings: null,
};

const sonarrConfig = {
  name: 'Test Sonarr',
  url: 'http://localhost:8989/api/v3',
  apiKey: 'test-api-key',
  settings: null,
};

describe('RadarrProvider — MediaActuator.tasks()', () => {
  it('declares its real actuator tasks as descriptors with destructive/affects', () => {
    const provider = new RadarrProvider(radarrConfig, log);
    const tasks = provider.tasks();
    const ids = tasks.map((t) => t.id);

    expect(ids).toContain('unmonitorMovie');
    expect(ids).toContain('triggerSearch');
    expect(ids).toContain('deleteMovieWithFiles');

    const unmonitor = tasks.find((t) => t.id === 'unmonitorMovie');
    expect(unmonitor?.destructive).toBe(false);
    expect(unmonitor?.affects).toBe('media');

    const del = tasks.find((t) => t.id === 'deleteMovieWithFiles');
    expect(del?.destructive).toBe(true);
  });

  it('declares its parameterized tasks and keeps deleteMovieKeepFiles modelled', async () => {
    const provider = new RadarrProvider(radarrConfig, log);
    const tasks = provider.tasks();
    const ids = tasks.map((t) => t.id);

    expect(ids).toContain('changeQualityProfile');
    expect(ids).toContain('addTag');
    expect(ids).toContain('removeTag');

    const changeQualityProfile = tasks.find((t) => t.id === 'changeQualityProfile')?.parameter;
    expect(changeQualityProfile?.label).toBe('Quality profile');
    expect(changeQualityProfile).toMatchObject({
      type: 'select',
      optionsRoute: 'quality-profiles',
    });

    const keepFiles = tasks.find((t) => t.id === 'deleteMovieKeepFiles')!;
    await expect(keepFiles.run([1])).rejects.toThrow(/not yet implemented/i);
  });
});

describe('SonarrProvider — MediaActuator.tasks()', () => {
  it('declares its real tasks bound to methods, parameterized tasks with their parameter', async () => {
    const provider = new SonarrProvider(sonarrConfig, log);
    const tasks = provider.tasks();
    const ids = tasks.map((t) => t.id);

    expect(ids).toContain('unmonitorSeries');
    expect(ids).toContain('triggerSearch');
    expect(ids).toContain('deleteSeriesWithFiles');

    const del = tasks.find((t) => t.id === 'deleteSeriesWithFiles');
    expect(del?.destructive).toBe(true);
    expect(del?.affects).toBe('media');

    expect(tasks.find((t) => t.id === 'addTag')?.parameter?.label).toBe('Tag');

    const keepFiles = tasks.find((t) => t.id === 'deleteSeriesKeepFiles')!;
    await expect(keepFiles.run([1])).rejects.toThrow(/not yet implemented/i);
  });
});

describe('pure-actuator media systems — modelled vocabularies', () => {
  const cfg = { name: 'x', url: 'http://localhost/api', apiKey: 'k', settings: null };

  it('Plex declares a fully realised vocabulary — destructive/affects flags intact, no modelled runs', () => {
    const tasks = new PlexProvider(cfg, log).tasks();
    expect(tasks.map((t) => t.id)).toEqual([
      'deleteFromLibrary',
      'refreshMetadata',
      'markPlayed',
      'markUnplayed',
    ]);

    const del = tasks.find((t) => t.id === 'deleteFromLibrary');
    expect(del?.destructive).toBe(true);
    expect(del?.affects).toBe('media');

    const refresh = tasks.find((t) => t.id === 'refreshMetadata');
    expect(refresh?.destructive).toBe(false);
    expect(refresh?.affects).toBe('media');
  });

  it('Jellyfin declares a fully realised vocabulary — addToCollection/removeFromCollection parameterized', () => {
    const tasks = new JellyfinProvider(cfg, log).tasks();
    expect(tasks.map((t) => t.id)).toEqual([
      'deleteItem',
      'refreshMetadata',
      'markPlayed',
      'markUnplayed',
      'addToCollection',
      'removeFromCollection',
    ]);

    const del = tasks.find((t) => t.id === 'deleteItem');
    expect(del?.destructive).toBe(true);
    expect(del?.affects).toBe('media');

    expect(tasks.find((t) => t.id === 'addToCollection')?.parameter?.label).toBe('Collection');
    expect(tasks.find((t) => t.id === 'removeFromCollection')?.parameter?.label).toBe('Collection');
  });

  it('Tautulli declares only its item-addressed task — session/notification tasks pruned', () => {
    const tasks = new TautulliProvider(cfg, log).tasks();
    expect(tasks.map((t) => t.id)).toEqual(['deleteWatchHistory']);
    expect(tasks[0].destructive).toBe(true);
    expect(tasks[0].affects).toBe('media');
  });
});
