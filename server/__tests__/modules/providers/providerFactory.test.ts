import { MetadataProviderType } from '@server/database/schema';
import type { MetadataProvider } from '@server/database/schema';
import { getChildLogger } from '@server/kernel/logger';
import { OverseerrProvider } from '@server/modules/providers/connections/overseerrProvider';
import { PlexProvider } from '@server/modules/providers/connections/plexProvider';
import { RadarrProvider } from '@server/modules/providers/connections/radarrProvider';
import { SonarrProvider } from '@server/modules/providers/connections/sonarrProvider';
import { TautulliProvider } from '@server/modules/providers/connections/tautulliProvider';
import { TvMazeProvider } from '@server/modules/providers/connections/tvmazeProvider';
import { ProviderFactory } from '@server/modules/providers/providerFactory';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

const log = getChildLogger('TestProviderFactory');

function makeProvider(type: MetadataProviderType): MetadataProvider {
  return {
    id: 1,
    type,
    name: 'Test Provider',
    url: 'http://localhost:9090',
    apiKey: 'test-key',
    settings: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ProviderFactory.create', () => {
  const factory = new ProviderFactory();

  it('creates a RadarrProvider for RADARR type', () => {
    expect(factory.create(makeProvider(MetadataProviderType.RADARR), log)).toBeInstanceOf(
      RadarrProvider
    );
  });

  it('creates a SonarrProvider for SONARR type', () => {
    expect(factory.create(makeProvider(MetadataProviderType.SONARR), log)).toBeInstanceOf(
      SonarrProvider
    );
  });

  it('creates a PlexProvider for PLEX type', () => {
    expect(factory.create(makeProvider(MetadataProviderType.PLEX), log)).toBeInstanceOf(
      PlexProvider
    );
  });

  it('creates a TautulliProvider for TAUTULLI type', () => {
    expect(factory.create(makeProvider(MetadataProviderType.TAUTULLI), log)).toBeInstanceOf(
      TautulliProvider
    );
  });

  it('creates an OverseerrProvider for OVERSEERR type', () => {
    expect(factory.create(makeProvider(MetadataProviderType.OVERSEERR), log)).toBeInstanceOf(
      OverseerrProvider
    );
  });

  it('throws an error for an unsupported provider type', () => {
    const unsupported = makeProvider(MetadataProviderType.SEERR);
    expect(() => factory.create(unsupported, log)).toThrow('Unsupported provider type: SEERR');
  });
});

describe('ProviderFactory.createMany', () => {
  const factory = new ProviderFactory();

  it('places each active provider into its typed slot, leaving absent types undefined', () => {
    const set = factory.createMany(
      [
        makeProvider(MetadataProviderType.RADARR),
        makeProvider(MetadataProviderType.PLEX),
        makeProvider(MetadataProviderType.TAUTULLI),
      ],
      log
    );

    expect(set.radarr).toBeInstanceOf(RadarrProvider);
    expect(set.plex).toBeInstanceOf(PlexProvider);
    expect(set.tautulli).toBeInstanceOf(TautulliProvider);
    expect(set.sonarr).toBeUndefined();
    expect(set.overseerr).toBeUndefined();
  });
});

describe('ProviderFactory.createTvMaze', () => {
  const factory = new ProviderFactory();

  afterEach(() => server.resetHandlers());

  it('returns a TvMazeProvider wired to the public TVmaze API', async () => {
    const provider = factory.createTvMaze(log);
    expect(provider).toBeInstanceOf(TvMazeProvider);

    server.use(
      http.get('https://api.tvmaze.com/lookup/shows', () => HttpResponse.json({ id: 169 }))
    );
    await expect(provider.lookupByTvdbId(81189)).resolves.toEqual({ id: 169 });
  });
});
