import { type MetadataProvider, MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { JellyfinProvider } from '@server/providers/jellyfinProvider';
import { describe, expect, it } from 'vitest';

const logger = getChildLogger('TestJellyfinProvider');

const mockEntity: MetadataProvider = {
  id: 4,
  type: MetadataProviderType.JELLYFIN,
  name: 'Test Jellyfin',
  url: 'http://localhost:8096',
  apiKey: 'fake-api-key',
  settings: { userId: 'test-user-id' },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('JellyfinProvider', () => {
  const provider = new JellyfinProvider(mockEntity, logger);

  it('fetches and parses libraries correctly', async () => {
    const libraries = await provider.getLibraries();
    expect(libraries).toHaveLength(2);
    expect(libraries[0].Name).toBe('Movies');
    expect(libraries[0].ItemId).toBe('aaaaaa');
  });

  it('fetches and parses library contents correctly', async () => {
    const items = await provider.getLibraryContents('aaaaaa');
    expect(items).toHaveLength(1);
    expect(items[0].Name).toBe('The Matrix');
    expect(items[0].Type).toBe('Movie');
  });
});
