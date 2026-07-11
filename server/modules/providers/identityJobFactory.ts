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
    const radarr = instances.find((i) => i.provider instanceof RadarrProvider)?.provider as
      | RadarrProvider
      | undefined;
    const sonarr = instances.find((i) => i.provider instanceof SonarrProvider)?.provider as
      | SonarrProvider
      | undefined;
    const plex = instances.find((i) => i.provider instanceof PlexProvider)?.provider as
      | PlexProvider
      | undefined;
    return new IdentityResolutionJob({
      db: this.db,
      radarrProvider: radarr,
      sonarrProvider: sonarr,
      plexProvider: plex,
      tvMazeLookup: this.providerFactory.createTvMaze(log),
    });
  }
}
