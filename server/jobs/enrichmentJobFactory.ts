import type { DrizzleDb } from '../database';
import { MetadataProviderType } from '../database/schema';
import { getChildLogger } from '../logger';
import { OverseerrProvider } from '../providers/overseerrProvider';
import { PlexProvider } from '../providers/plexProvider';
import { TautulliProvider } from '../providers/tautulliProvider';
import type { ProviderSettingsService } from '../services/providerSettingsService';
import type { EnrichmentJobFactoryLike } from '../services/systemTaskRunner';
import { EnrichmentJob } from './enrichmentJob';

const log = getChildLogger('EnrichmentJobFactory');

export interface EnrichmentJobFactoryDeps {
  db: DrizzleDb;
  providerSettingsService: ProviderSettingsService;
}

export class EnrichmentJobFactory implements EnrichmentJobFactoryLike {
  private readonly db: DrizzleDb;
  private readonly providerSettingsService: ProviderSettingsService;

  constructor(deps: EnrichmentJobFactoryDeps) {
    this.db = deps.db;
    this.providerSettingsService = deps.providerSettingsService;
  }

  async create(): Promise<EnrichmentJob> {
    const providers = await this.providerSettingsService.findActiveByTypes([
      MetadataProviderType.TAUTULLI,
      MetadataProviderType.OVERSEERR,
      MetadataProviderType.PLEX,
    ]);
    const deps: ConstructorParameters<typeof EnrichmentJob>[0] = { db: this.db };
    for (const settings of providers) {
      switch (settings.type) {
        case MetadataProviderType.TAUTULLI:
          deps.tautulliProvider = new TautulliProvider(settings, log);
          break;
        case MetadataProviderType.OVERSEERR:
          deps.overseerrProvider = new OverseerrProvider(settings, log);
          break;
        case MetadataProviderType.PLEX:
          deps.plexProvider = new PlexProvider(settings, log);
          break;
      }
    }
    return new EnrichmentJob(deps);
  }
}
