import type { Logger } from 'winston';
import type { MetadataProvider } from '../database/schema';
import { MetadataProviderType } from '../database/schema';
import { RadarrProvider } from './radarrProvider';
import { SonarrProvider } from './sonarrProvider';

export type ArrProvider = RadarrProvider | SonarrProvider;

export interface IProviderFactory {
  create(provider: MetadataProvider, logger: Logger): ArrProvider;
}

export class ProviderFactory implements IProviderFactory {
  create(provider: MetadataProvider, logger: Logger): ArrProvider {
    switch (provider.type) {
      case MetadataProviderType.RADARR:
        return new RadarrProvider(provider, logger);
      case MetadataProviderType.SONARR:
        return new SonarrProvider(provider, logger);
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }
}
