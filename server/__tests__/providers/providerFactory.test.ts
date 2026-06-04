import { MetadataProviderType } from '@server/database/schema';
import type { MetadataProvider } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { ProviderFactory } from '@server/providers/providerFactory';
import { RadarrProvider } from '@server/providers/radarrProvider';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import { describe, expect, it } from 'vitest';

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

describe('ProviderFactory', () => {
  const factory = new ProviderFactory();

  it('creates a RadarrProvider for RADARR type', () => {
    const instance = factory.create(makeProvider(MetadataProviderType.RADARR), log);
    expect(instance).toBeInstanceOf(RadarrProvider);
  });

  it('creates a SonarrProvider for SONARR type', () => {
    const instance = factory.create(makeProvider(MetadataProviderType.SONARR), log);
    expect(instance).toBeInstanceOf(SonarrProvider);
  });

  it('throws an error for an unsupported provider type', () => {
    const unsupported = makeProvider('PLEX' as MetadataProviderType);
    expect(() => factory.create(unsupported, log)).toThrow('Unsupported provider type: PLEX');
  });
});
