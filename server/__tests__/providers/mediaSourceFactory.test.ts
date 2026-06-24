import { type MetadataProvider, MetadataProviderType } from '@server/database/schema';
import { MediaSourceFactory } from '@server/providers/mediaSourceFactory';
import { ProviderFactory } from '@server/providers/providerFactory';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { describe, expect, it } from 'vitest';

const settings = (type: MetadataProviderType): MetadataProvider => ({
  id: 1,
  type,
  name: type,
  url: 'http://localhost',
  apiKey: 'k',
  settings: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const settingsServiceReturning = (active: MetadataProvider[]) =>
  ({ findActiveByTypes: async () => active }) as unknown as ProviderSettingsService;

const buildFactory = (active: MetadataProvider[]) =>
  new MediaSourceFactory({
    providerSettingsService: settingsServiceReturning(active),
    providerFactory: new ProviderFactory(),
  });

describe('MediaSourceFactory.forContentType', () => {
  it('binds the active owner provider for a content type as a MediaSource', async () => {
    const source = await buildFactory([settings(MetadataProviderType.RADARR)]).forContentType(
      'movie'
    );

    expect(source?.enrichmentSourceType).toBe('RADARR');
  });
});
