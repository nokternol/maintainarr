import type { NormalizedMovie } from '@server/domain/movie';
import type { MediaSource } from '@server/providers/mediaSource';
import { normalizeRadarrMovie } from '@server/providers/normalizeMedia';
import type { RadarrMovie } from '@server/providers/radarrProvider';
import { MediaQueryEngine } from '@server/services/mediaQueryEngine';
import { describe, expect, it } from 'vitest';
import { createRadarrMovie } from '../../../tests/factories';

const radarrIds = (set: { _sourceIds: NormalizedMovie['_sourceIds'] }[]): (number | undefined)[] =>
  set.map((m) => m._sourceIds.radarr);

/** A `MediaSource` over raw Radarr movies — the read role the engine consumes. */
const radarrSource = (movies: RadarrMovie[]): MediaSource => ({
  getMediaItems: async () => movies.map(normalizeRadarrMovie),
  idOf: (item) => (item as NormalizedMovie)._sourceIds.radarr,
  enrichmentSourceType: 'RADARR',
});

describe('MediaQueryEngine', () => {
  describe('evaluate — single include source', () => {
    it('returns the ids of the items satisfying the include predicate', async () => {
      const source = radarrSource([
        createRadarrMovie({ id: 1, title: 'Downloaded', hasFile: true }),
        createRadarrMovie({ id: 2, title: 'Missing', hasFile: false }),
      ]);

      const engine = new MediaQueryEngine();
      const result = await engine.evaluate({
        source,
        contentType: 'movie',
        sources: [{ filterValues: [{ key: 'hasFile', value: true }], role: 'include' }],
      });

      expect(radarrIds(result as NormalizedMovie[])).toEqual([1]);
    });
  });

  describe('evaluate — include + exclude', () => {
    it('returns the include set minus the exclude set', async () => {
      const source = radarrSource([
        createRadarrMovie({ id: 1, title: 'Keep', hasFile: true, qualityProfileId: 10 }),
        createRadarrMovie({ id: 2, title: 'Skip', hasFile: false, qualityProfileId: 10 }),
        createRadarrMovie({ id: 3, title: 'Remove', hasFile: true, qualityProfileId: 20 }),
      ]);

      const engine = new MediaQueryEngine();
      const result = await engine.evaluate({
        source,
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
      const source = radarrSource([
        createRadarrMovie({ id: 1, title: 'A' }),
        createRadarrMovie({ id: 2, title: 'B' }),
      ]);

      const engine = new MediaQueryEngine();
      const result = await engine.evaluate({
        source,
        contentType: 'movie',
        sources: [{ filterValues: [], role: 'include' }],
      });

      expect(radarrIds(result as NormalizedMovie[])).toEqual([1, 2]);
    });
  });
});
