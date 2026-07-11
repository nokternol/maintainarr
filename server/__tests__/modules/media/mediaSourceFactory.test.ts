import { type MetadataProvider, MetadataProviderType } from '@server/database/schema';
import { MediaSourceFactory } from '@server/modules/media/mediaSourceFactory';
import { ProviderFactory } from '@server/modules/providers/providerFactory';
import type { ProviderSettingsService } from '@server/modules/providers/providerSettingsService';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

const settings = (type: MetadataProviderType): MetadataProvider => ({
  id: 1,
  type,
  name: type,
  url: 'http://localhost/api/v3',
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
  afterEach(() => server.resetHandlers());

  it('binds the active owner provider for a content type as a MediaSource carrying its providerId', async () => {
    server.use(
      http.get('http://localhost/api/v3/movie', () =>
        HttpResponse.json([{ id: 1, title: 'M', hasFile: true, monitored: true, tmdbId: 1 }])
      )
    );

    const source = await buildFactory([settings(MetadataProviderType.RADARR)]).forContentType(
      'movie'
    );

    const [item] = await source!.getMediaItems();
    expect(item._sourceIds.providerId).toBe(1);
  });
});
