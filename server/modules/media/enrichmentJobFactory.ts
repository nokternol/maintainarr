import { MetadataProviderType } from '../../database/schema';
import type { DrizzleDb } from '../../kernel/db';
import { getChildLogger } from '../../kernel/logger';
import type { EnrichmentJobFactoryLike } from '../../modules/system';
import type { ProviderFactory, ProviderSettingsService } from '../providers';
import {
  overseerrEnricher,
  plexEnricher,
  tautulliEnricher,
  tmdbEnricher,
} from './enrichment/enricherAdapters';
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
    const enrichers = [
      tautulli && tautulliEnricher(tautulli),
      overseerr && overseerrEnricher(overseerr),
      plex && plexEnricher(plex),
      tmdb && tmdbEnricher(tmdb),
    ].filter((e) => e !== undefined);
    return new EnrichmentJob({ db: this.db, enrichers });
  }
}
