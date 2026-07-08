import { MetadataProviderType } from '../database/schema';
import type { DrizzleDb } from '../kernel/db';
import { getChildLogger } from '../kernel/logger';
import type { ProviderFactory } from '../providers/providerFactory';
import type { ProviderSettingsService } from '../services/providerSettingsService';
import type { IdentityJobFactoryLike } from '../services/systemTaskRunner';
import { IdentityResolutionJob } from './identityResolutionJob';

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
    const { radarr, sonarr, plex } = this.providerFactory.createMany(providers, log);
    return new IdentityResolutionJob({
      db: this.db,
      radarrProvider: radarr,
      sonarrProvider: sonarr,
      plexProvider: plex,
      tvMazeLookup: this.providerFactory.createTvMaze(log),
    });
  }
}
