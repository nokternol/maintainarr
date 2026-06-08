import { getChildLogger } from '@server/logger';
import type { ProviderConfig } from '@server/providers/baseMetadataProvider';
import { PlexProvider } from '@server/providers/plexProvider';
import { describe, expect, it } from 'vitest';

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
});
