import { MetadataProviderType } from '@server/database/schema';
import type { DrizzleDb } from '@server/kernel/db';
import { getChildLogger } from '@server/kernel/logger';
import type { IdentityJobFactoryLike } from '@server/modules/system';
import { PlexProvider } from './connections/plexProvider';
import { RadarrProvider } from './connections/radarrProvider';
import { SonarrProvider } from './connections/sonarrProvider';
import { IdentityResolutionJob } from './identityResolutionJob';
import type { ProviderFactory } from './providerFactory';
import type { ProviderSettingsService } from './providerSettingsService';

const log = getChildLogger('IdentityJobFactory');

export interface IdentityJobFactoryDeps {
  db: DrizzleDb;
  providerSettingsService: ProviderSettingsService;
  providerFactory: ProviderFactory;
}

export class IdentityJobFactory implements IdentityJobFactoryLike {
  private readonly db: DrizzleDb;
  private readonly providerSettingsService: ProviderSettingsService;
  private readonly providerFactory: ProviderFactory;

  constructor(deps: IdentityJobFactoryDeps) {
    this.db = deps.db;
    this.providerSettingsService = deps.providerSettingsService;
    this.providerFactory = deps.providerFactory;
  }

  async create(): Promise<IdentityResolutionJob> {
    const providers = await this.providerSettingsService.findActiveByTypes([
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
    ]);
    const instances = this.providerFactory.createInstances(providers, log);
    const radarr = instances.find((i) => i.provider instanceof RadarrProvider);
    const sonarr = instances.find((i) => i.provider instanceof SonarrProvider);
    const plex = instances.find((i) => i.provider instanceof PlexProvider);
    return new IdentityResolutionJob({
      db: this.db,
      radarrProvider: radarr?.provider as RadarrProvider | undefined,
      radarrProviderId: radarr?.settings.id,
      sonarrProvider: sonarr?.provider as SonarrProvider | undefined,
      sonarrProviderId: sonarr?.settings.id,
      plexProvider: plex?.provider as PlexProvider | undefined,
      tvMazeLookup: this.providerFactory.createTvMaze(log),
    });
  }
}
