import type { DrizzleDb } from '../database';
import { MetadataProviderType } from '../database/schema';
import { getChildLogger } from '../logger';
import { PlexProvider } from '../providers/plexProvider';
import type { IProviderFactory } from '../providers/providerFactory';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';
import { TvMazeProvider } from '../providers/tvmazeProvider';
import type { ProviderSettingsService } from '../services/providerSettingsService';
import type { IdentityJobFactoryLike } from '../services/systemTaskRunner';
import { IdentityResolutionJob } from './identityResolutionJob';

// TVmaze is a keyless public service — no configured provider required.
const TVMAZE_BASE_URL = 'https://api.tvmaze.com';

const log = getChildLogger('IdentityJobFactory');

export interface IdentityJobFactoryDeps {
  db: DrizzleDb;
  providerSettingsService: ProviderSettingsService;
  providerFactory: IProviderFactory;
}

export class IdentityJobFactory implements IdentityJobFactoryLike {
  private readonly db: DrizzleDb;
  private readonly providerSettingsService: ProviderSettingsService;
  private readonly providerFactory: IProviderFactory;

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
    let radarrProvider: RadarrProvider | undefined;
    let sonarrProvider: SonarrProvider | undefined;
    let plexProvider: PlexProvider | undefined;
    for (const settings of providers) {
      if (settings.type === MetadataProviderType.PLEX) {
        plexProvider = new PlexProvider(settings, log);
        continue;
      }
      const provider = this.providerFactory.create(settings, log);
      if (settings.type === MetadataProviderType.RADARR) {
        radarrProvider = provider as RadarrProvider;
      } else if (settings.type === MetadataProviderType.SONARR) {
        sonarrProvider = provider as SonarrProvider;
      }
    }
    const tvMazeLookup = new TvMazeProvider(
      { name: 'TVmaze', url: TVMAZE_BASE_URL, apiKey: null, settings: null },
      log
    );
    return new IdentityResolutionJob({
      db: this.db,
      radarrProvider,
      sonarrProvider,
      plexProvider,
      tvMazeLookup,
    });
  }
}
