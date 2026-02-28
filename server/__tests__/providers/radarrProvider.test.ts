import { type MetadataProvider, MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { RadarrProvider } from '@server/providers/radarrProvider';
import { describe, expect, it } from 'vitest';

const mockLogger = getChildLogger('TestRadarrProvider');

const mockEntity: MetadataProvider = {
  id: 1,
  type: MetadataProviderType.RADARR,
  name: 'Test Radarr',
  url: 'http://localhost:7878/api/v3',
  apiKey: 'fake-api-key',
  settings: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RadarrProvider', () => {
  const provider = new RadarrProvider(mockEntity, mockLogger);

  it('fetches and parses movies correctly', async () => {
    const movies = await provider.getMovies();
    expect(movies).toHaveLength(1);
    expect(movies[0].title).toBe('The Matrix');
    expect(movies[0].tmdbId).toBe(603);
  });

  it('fetches and parses quality profiles correctly', async () => {
    const profiles = await provider.getProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe('HD-1080p');
  });

  it('fetches and parses root folders correctly', async () => {
    const folders = await provider.getRootFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].path).toBe('/movies');
  });

  it('fetches and parses tags correctly', async () => {
    const tags = await provider.getTags();
    expect(tags).toHaveLength(2);
    expect(tags[0].label).toBe('action');
  });
});
