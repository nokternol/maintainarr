import type { NormalizedMovie } from '@server/domain/movie';
import type { RadarrProvider } from '@server/providers/radarrProvider';
import { MediaQueryEngine } from '@server/services/mediaQueryEngine';
import { describe, expect, it } from 'vitest';
import { createRadarrMovie } from '../../../tests/factories';

const radarrIds = (set: { _sourceIds: NormalizedMovie['_sourceIds'] }[]): (number | undefined)[] =>
  set.map((m) => m._sourceIds.radarr);

describe('MediaQueryEngine', () => {
  describe('evaluate — single include source', () => {
    it('returns the ids of the items satisfying the include predicate', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'Downloaded', hasFile: true }),
        createRadarrMovie({ id: 2, title: 'Missing', hasFile: false }),
      ];
      const provider = { getMovies: async () => movies } as unknown as RadarrProvider;

      const engine = new MediaQueryEngine();
      const result = await engine.evaluate({
        provider,
        contentType: 'movie',
        sources: [{ filterValues: [{ key: 'hasFile', value: true }], role: 'include' }],
      });

      expect(radarrIds(result as NormalizedMovie[])).toEqual([1]);
    });
  });

  describe('evaluate — include + exclude', () => {
    it('returns the include set minus the exclude set', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'Keep', hasFile: true, qualityProfileId: 10 }),
        createRadarrMovie({ id: 2, title: 'Skip', hasFile: false, qualityProfileId: 10 }),
        createRadarrMovie({ id: 3, title: 'Remove', hasFile: true, qualityProfileId: 20 }),
      ];
      const provider = { getMovies: async () => movies } as unknown as RadarrProvider;

      const engine = new MediaQueryEngine();
      const result = await engine.evaluate({
        provider,
        contentType: 'movie',
        sources: [
          { filterValues: [{ key: 'hasFile', value: true }], role: 'include' },
          { filterValues: [{ key: 'qualityProfileIds', value: '20' }], role: 'exclude' },
        ],
      });

      expect(radarrIds(result as NormalizedMovie[])).toEqual([1]);
    });
  });

  describe('evaluate — empty filter values', () => {
    it('matches every item when the include source has no predicates', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'A' }),
        createRadarrMovie({ id: 2, title: 'B' }),
      ];
      const provider = { getMovies: async () => movies } as unknown as RadarrProvider;

      const engine = new MediaQueryEngine();
      const result = await engine.evaluate({
        provider,
        contentType: 'movie',
        sources: [{ filterValues: [], role: 'include' }],
      });

      expect(radarrIds(result as NormalizedMovie[])).toEqual([1, 2]);
    });
  });

  describe('evaluate — unknown content type', () => {
    it('resolves to an empty set when no owner handles the content type', async () => {
      const provider = {
        getMovies: async () => [createRadarrMovie({ id: 1, title: 'A' })],
      } as unknown as RadarrProvider;

      const engine = new MediaQueryEngine();
      const result = await engine.evaluate({
        provider,
        contentType: 'music' as unknown as 'movie',
        sources: [{ filterValues: [], role: 'include' }],
      });

      expect(result).toEqual([]);
    });
  });
});
