import { getChildLogger } from '@server/kernel/logger';
import type { ProviderConfig } from '@server/providers/baseProviderConnection';
import { JellyfinProvider } from '@server/providers/jellyfinProvider';
import { describe, expect, it } from 'vitest';

const logger = getChildLogger('TestJellyfinProvider');

const mockConfig: ProviderConfig = {
  name: 'Test Jellyfin',
  url: 'http://localhost:8096',
  apiKey: 'fake-api-key',
  settings: { userId: 'test-user-id' },
};

describe('JellyfinProvider', () => {
  const provider = new JellyfinProvider(mockConfig, logger);

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
