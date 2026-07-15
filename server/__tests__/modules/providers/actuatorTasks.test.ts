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

  it('models the rest of its vocabulary as parameterless tasks whose run throws', async () => {
    const provider = new RadarrProvider(radarrConfig, log);
    const ids = provider.tasks().map((t) => t.id);

    expect(ids).toContain('changeQualityProfile');
    expect(ids).toContain('addTag');
    expect(ids).toContain('removeTag');

    const changeQuality = provider.tasks().find((t) => t.id === 'changeQualityProfile')!;
    await expect(changeQuality.run([1])).rejects.toThrow(/not yet implemented/i);
  });
});

describe('SonarrProvider — MediaActuator.tasks()', () => {
  it('declares its real tasks bound to methods and models the rest', async () => {
    const provider = new SonarrProvider(sonarrConfig, log);
    const tasks = provider.tasks();
    const ids = tasks.map((t) => t.id);

    expect(ids).toContain('unmonitorSeries');
    expect(ids).toContain('triggerSearch');
    expect(ids).toContain('deleteSeriesWithFiles');

    const del = tasks.find((t) => t.id === 'deleteSeriesWithFiles');
    expect(del?.destructive).toBe(true);
    expect(del?.affects).toBe('media');

    const addTag = tasks.find((t) => t.id === 'addTag')!;
    await expect(addTag.run([1])).rejects.toThrow(/not yet implemented/i);
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

  it('Jellyfin declares a fully realised vocabulary — addToCollection parameterized', () => {
    const tasks = new JellyfinProvider(cfg, log).tasks();
    expect(tasks.map((t) => t.id)).toEqual([
      'deleteItem',
      'refreshMetadata',
      'markPlayed',
      'markUnplayed',
      'addToCollection',
    ]);

    const del = tasks.find((t) => t.id === 'deleteItem');
    expect(del?.destructive).toBe(true);
    expect(del?.affects).toBe('media');

    expect(tasks.find((t) => t.id === 'addToCollection')?.parameter?.label).toBe('Collection');
  });

  const cases: Array<
    [string, () => { tasks: () => { id: string; run: (i: number[]) => Promise<void> }[] }, string]
  > = [['Tautulli', () => new TautulliProvider(cfg, log), 'deleteWatchHistory']];

  for (const [name, make, expectedId] of cases) {
    it(`${name} declares its tasks, every one modelled (run throws)`, async () => {
      const tasks = make().tasks();
      expect(tasks.map((t) => t.id)).toContain(expectedId);
      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        await expect(task.run([1])).rejects.toThrow(/not yet implemented/i);
      }
    });
  }
});
