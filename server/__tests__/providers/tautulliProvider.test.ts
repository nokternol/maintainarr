import { MetadataProviderType } from '@server/database/schema';
import type { NormalizedMovie } from '@server/domain/movie';
import { getChildLogger } from '@server/kernel/logger';
import type { ProviderConfig } from '@server/providers/baseProviderConnection';
import { TautulliProvider } from '@server/providers/tautulliProvider';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

const logger = getChildLogger('TestTautulliProvider');

const mockConfig: ProviderConfig = {
  name: 'Test Tautulli',
  url: 'http://localhost:8181',
  apiKey: 'fake-api-key',
  settings: {},
};

describe('TautulliProvider', () => {
  const provider = new TautulliProvider(mockConfig, logger);

  it('fetches and parses library stats correctly', async () => {
    const stats = await provider.getLibraryStats();
    expect(stats).toHaveLength(2);
    expect(stats[0].section_name).toBe('Movies');
    expect(stats[0].section_type).toBe('movie');
  });

  it('fetches and parses home stats correctly', async () => {
    const stats = await provider.getHomeStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].stat_id).toBe('top_movies');
    expect(stats[0].rows[0].title).toBe('The Matrix');
  });

  it('fetches and parses watch history correctly', async () => {
    const history = await provider.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe('The Matrix');
    expect(history[0].watched_status).toBe(1);
  });

  describe('enrich (MediaEnricher)', () => {
    it('decorates a matched item with play count and most-recent watch, tagged by provider', async () => {
      const older = 1_600_000_000;
      const newer = 1_700_000_000;
      vi.spyOn(provider, 'getHistory').mockResolvedValue([
        {
          rating_key: 'plex-1',
          title: 'M',
          user: 'u',
          watched_status: 1,
          duration: 1,
          play_duration: 1,
          played_at: older,
        },
        {
          rating_key: 'plex-1',
          title: 'M',
          user: 'u',
          watched_status: 1,
          duration: 1,
          play_duration: 1,
          played_at: newer,
        },
      ]);
      const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'M' };

      const result = await provider.enrich([item]);

      expect(result.provider).toBe(MetadataProviderType.TAUTULLI);
      expect(result.items[0].playCount).toBe(2);
      expect(result.items[0].lastWatchedAt).toBe(new Date(newer * 1000).toISOString());
    });
  });
});
