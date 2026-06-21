import { MetadataProviderType } from '@server/database/schema';
import { taskManifest } from '@server/services/taskManifest';
import { describe, expect, it } from 'vitest';

describe('taskManifest', () => {
  it('lists the RADARR actuator tasks with their descriptors', () => {
    const tasks = taskManifest(MetadataProviderType.RADARR);
    const ids = tasks.map((t) => t.id);

    expect(ids).toContain('unmonitorMovie');
    expect(ids).toContain('triggerSearch');

    const unmonitor = tasks.find((t) => t.id === 'unmonitorMovie');
    expect(unmonitor?.affects).toBe('media');
    expect(unmonitor?.destructive).toBe(false);
  });

  it('exposes no tasks for an enricher-only type (TMDB)', () => {
    expect(taskManifest(MetadataProviderType.TMDB)).toEqual([]);
  });

  it('marks a delete task as destructive', () => {
    const del = taskManifest(MetadataProviderType.RADARR).find(
      (t) => t.id === 'deleteMovieWithFiles'
    );
    expect(del?.destructive).toBe(true);
  });
});
