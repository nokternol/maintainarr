import type { DrizzleDb } from '../database';
import { MetadataProviderType } from '../database/schema';
import { EnrichmentJob } from '../jobs/enrichmentJob';
import { IdentityResolutionJob } from '../jobs/identityResolutionJob';
import { getChildLogger } from '../logger';
import { OverseerrProvider } from '../providers/overseerrProvider';
import { PlexProvider } from '../providers/plexProvider';
import { type IProviderFactory, ProviderFactory } from '../providers/providerFactory';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';
import { TautulliProvider } from '../providers/tautulliProvider';
import { TvMazeProvider } from '../providers/tvmazeProvider';
import type { ProviderSettingsService } from './providerSettingsService';

// TVmaze is a keyless public service — no configured provider required.
const TVMAZE_BASE_URL = 'https://api.tvmaze.com';

const log = getChildLogger('SystemTaskRunner');

export interface IdentityJobLike {
  runForMovies(): Promise<void>;
  runForSeries(): Promise<void>;
  runForPlex(): Promise<void>;
}

export interface EnrichmentJobLike {
  run(): Promise<void>;
}

export interface SystemTaskRunnerDeps {
  providerSettingsService?: ProviderSettingsService;
  providerFactory?: IProviderFactory;
  db?: DrizzleDb;
  createIdentityJob?: () => IdentityJobLike | Promise<IdentityJobLike>;
  createEnrichmentJob?: () => EnrichmentJobLike | Promise<EnrichmentJobLike>;
}

type SystemTaskFn = (runner: SystemTaskRunner) => Promise<void>;

const SYSTEM_TASKS: Record<string, SystemTaskFn> = {
  'system:identity-resolution': async (runner) => {
    const job = await runner.buildIdentityJob();
    await job.runForMovies();
    await job.runForSeries();
    await job.runForPlex();
  },
  'system:enrichment': async (runner) => {
    const job = await runner.buildEnrichmentJob();
    await job.run();
  },
};

export class SystemTaskRunner {
  private readonly providerSettingsService?: ProviderSettingsService;
  private readonly providerFactory: IProviderFactory;
  private readonly db?: DrizzleDb;
  private readonly createIdentityJob: () => IdentityJobLike | Promise<IdentityJobLike>;
  private readonly createEnrichmentJob: () => EnrichmentJobLike | Promise<EnrichmentJobLike>;

  constructor(deps: SystemTaskRunnerDeps = {}) {
    this.providerSettingsService = deps.providerSettingsService;
    this.providerFactory = deps.providerFactory ?? new ProviderFactory();
    this.db = deps.db;
    this.createIdentityJob = deps.createIdentityJob ?? (() => this.defaultIdentityJob());
    this.createEnrichmentJob = deps.createEnrichmentJob ?? (() => this.defaultEnrichmentJob());
  }

  async buildIdentityJob(): Promise<IdentityJobLike> {
    return this.createIdentityJob();
  }

  async buildEnrichmentJob(): Promise<EnrichmentJobLike> {
    return this.createEnrichmentJob();
  }

  private async defaultEnrichmentJob(): Promise<EnrichmentJob> {
    if (!this.db || !this.providerSettingsService) {
      throw new Error('SystemTaskRunner is missing db/providerSettingsService dependencies');
    }
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

  private async defaultIdentityJob(): Promise<IdentityResolutionJob> {
    if (!this.db || !this.providerSettingsService) {
      throw new Error('SystemTaskRunner is missing db/providerSettingsService dependencies');
    }
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

  async run(taskId: string): Promise<void> {
    const handler = SYSTEM_TASKS[taskId];
    if (!handler) throw new Error(`Task "${taskId}" is not yet implemented`);
    await handler(this);
  }
}
