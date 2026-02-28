import { type MetadataProvider, MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import { describe, expect, it } from 'vitest';

const logger = getChildLogger('TestSonarrProvider');

const mockEntity: MetadataProvider = {
  id: 2,
  type: MetadataProviderType.SONARR,
  name: 'Test Sonarr',
  url: 'http://localhost:8989/api/v3',
  apiKey: 'fake-api-key',
  settings: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SonarrProvider', () => {
  const provider = new SonarrProvider(mockEntity, logger);

  it('fetches and parses series correctly', async () => {
    const series = await provider.getSeries();
    expect(series).toHaveLength(1);
    expect(series[0].title).toBe('Breaking Bad');
    expect(series[0].tvdbId).toBe(81189);
  });

  it('fetches and parses quality profiles correctly', async () => {
    const profiles = await provider.getProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe('HD-1080p');
  });

  it('fetches and parses root folders correctly', async () => {
    const folders = await provider.getRootFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].path).toBe('/tv');
  });

  it('fetches and parses tags correctly', async () => {
    const tags = await provider.getTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].label).toBe('drama');
  });
});
