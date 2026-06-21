import { MetadataProviderType } from '@server/database/schema';
import type { NormalizedMovie } from '@server/domain/movie';
import { getChildLogger } from '@server/logger';
import type { ProviderConfig } from '@server/providers/baseProviderConnection';
import { PlexProvider } from '@server/providers/plexProvider';
import { describe, expect, it, vi } from 'vitest';

const logger = getChildLogger('TestPlexProvider');

const mockConfig: ProviderConfig = {
  name: 'Test Plex',
  url: 'http://localhost:32400',
  apiKey: 'fake-plex-token',
  settings: {},
};

describe('PlexProvider', () => {
  const provider = new PlexProvider(mockConfig, logger);

  it('fetches and parses libraries correctly', async () => {
    const libraries = await provider.getLibraries();
    expect(libraries).toHaveLength(2);
    expect(libraries[0].title).toBe('Movies');
    expect(libraries[0].type).toBe('movie');
    expect(libraries[0].key).toBe('1');
  });

  it('fetches and parses library contents correctly', async () => {
    const items = await provider.getLibraryContents('1');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('The Matrix');
    expect(items[0].type).toBe('movie');
    expect(items[0].year).toBe(1999);
  });

  it('fetches contents for a different library section', async () => {
    const items = await provider.getLibraryContents('2');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Breaking Bad');
    expect(items[0].type).toBe('show');
  });

  it('getLibraryContents passes through viewCount and lastViewedAt when present', async () => {
    const items = await provider.getLibraryContents('1');
    expect(items[0].viewCount).toBe(3);
    expect(items[0].lastViewedAt).toBe(1700000000);
  });

  describe('enrich (MediaEnricher)', () => {
    it('decorates a matched item with its play count, tagged by provider', async () => {
      vi.spyOn(provider, 'getAllItems').mockResolvedValue([
        { ratingKey: 'plex-1', title: 'The Matrix', type: 'movie', viewCount: 2 },
      ]);
      const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

      const result = await provider.enrich([item]);

      expect(result.provider).toBe(MetadataProviderType.PLEX);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].playCount).toBe(2);
    });

    it('omits and does not mutate an item whose key it does not speak', async () => {
      vi.spyOn(provider, 'getAllItems').mockResolvedValue([
        { ratingKey: 'plex-1', title: 'The Matrix', type: 'movie', viewCount: 2 },
      ]);
      const item: NormalizedMovie = { _sourceIds: { plex: 'plex-999' }, title: 'Unknown' };

      const result = await provider.enrich([item]);

      expect(result.items).toHaveLength(0);
      expect(item.playCount).toBeUndefined();
    });
  });
});
