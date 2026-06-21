import type { DrizzleDb } from '../database';
import { MetadataProviderType } from '../database/schema';
import { getChildLogger } from '../logger';
import type { ProviderFactory } from '../providers/providerFactory';
import type { ProviderSettingsService } from '../services/providerSettingsService';
import type { EnrichmentJobFactoryLike } from '../services/systemTaskRunner';
import { EnrichmentJob } from './enrichmentJob';

const log = getChildLogger('EnrichmentJobFactory');

export interface EnrichmentJobFactoryDeps {
  db: DrizzleDb;
  providerSettingsService: ProviderSettingsService;
  providerFactory: ProviderFactory;
}

export class EnrichmentJobFactory implements EnrichmentJobFactoryLike {
  private readonly db: DrizzleDb;
  private readonly providerSettingsService: ProviderSettingsService;
  private readonly providerFactory: ProviderFactory;

  constructor(deps: EnrichmentJobFactoryDeps) {
    this.db = deps.db;
    this.providerSettingsService = deps.providerSettingsService;
    this.providerFactory = deps.providerFactory;
  }

  async create(): Promise<EnrichmentJob> {
    const providers = await this.providerSettingsService.findActiveByTypes([
      MetadataProviderType.TAUTULLI,
      MetadataProviderType.OVERSEERR,
      MetadataProviderType.PLEX,
      MetadataProviderType.TMDB,
    ]);
    const { tautulli, overseerr, plex, tmdb } = this.providerFactory.createMany(providers, log);
    const enrichers = [tautulli, overseerr, plex, tmdb].filter((e) => e !== undefined);
    return new EnrichmentJob({ db: this.db, enrichers });
  }
}
