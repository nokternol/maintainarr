import { MetadataProviderType } from '../database/schema';
import { getChildLogger } from '../logger';
import { type IProviderFactory, ProviderFactory } from '../providers/providerFactory';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';
import { applyMovieFilters, applySeriesFilters } from '../utils/mediaFilters';
import type { AutomationRunService } from './automationRunService';
import type { AutomationService } from './automationService';
import type { ProviderSettingsService } from './providerSettingsService';
import type { QueryFilters } from './savedQueryService';

const log = getChildLogger('AutomationExecutor');

interface ExecutorDeps {
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  providerSettingsService: ProviderSettingsService;
  providerFactory?: IProviderFactory;
}

export class AutomationExecutor {
  private readonly automationService: AutomationService;
  private readonly automationRunService: AutomationRunService;
  private readonly providerSettingsService: ProviderSettingsService;
  private readonly providerFactory: IProviderFactory;

  constructor(deps: ExecutorDeps) {
    this.automationService = deps.automationService;
    this.automationRunService = deps.automationRunService;
    this.providerSettingsService = deps.providerSettingsService;
    this.providerFactory = deps.providerFactory ?? new ProviderFactory();
  }

  async execute(automationId: number): Promise<void> {
    let itemCount = 0;

    try {
      const automation = await this.automationService.getById(automationId);
      if (!automation.provider || !automation.query) {
        throw new Error(`Automation ${automationId} has no provider or query — cannot execute`);
      }
      const provider = await this.providerSettingsService.findById(automation.provider.id);
      const filters = automation.query.filters;
      const taskId = automation.taskId;

      if (provider.type === MetadataProviderType.RADARR) {
        const radarr = this.providerFactory.create(provider, log) as RadarrProvider;
        const movies = await radarr.getMovies();
        const matched = applyMovieFilters(movies, {
          title: typeof filters.title === 'string' ? filters.title : undefined,
          yearMin: typeof filters.yearMin === 'number' ? filters.yearMin : undefined,
          yearMax: typeof filters.yearMax === 'number' ? filters.yearMax : undefined,
          hasFile: coerceBool(filters.hasFile),
          movieTagIds: typeof filters.movieTagIds === 'string' ? filters.movieTagIds : undefined,
          movieQualityProfileIds:
            typeof filters.movieQualityProfileIds === 'string'
              ? filters.movieQualityProfileIds
              : undefined,
          movieGenres: typeof filters.movieGenres === 'string' ? filters.movieGenres : undefined,
        });
        itemCount = matched.length;
        const handler = RADARR_TASKS[taskId];
        if (handler) {
          await handler(
            radarr,
            matched.map((m) => m.id)
          );
        } else {
          return await this.recordUnimplemented(automationId, taskId, provider.type);
        }
      } else if (provider.type === MetadataProviderType.SONARR) {
        const sonarr = this.providerFactory.create(provider, log) as SonarrProvider;
        const series = await sonarr.getSeries();
        const matched = applySeriesFilters(series, {
          title: typeof filters.title === 'string' ? filters.title : undefined,
          yearMin: typeof filters.yearMin === 'number' ? filters.yearMin : undefined,
          yearMax: typeof filters.yearMax === 'number' ? filters.yearMax : undefined,
          monitored: coerceBool(filters.monitored),
          seriesStatus: typeof filters.seriesStatus === 'string' ? filters.seriesStatus : undefined,
          seriesTagIds: typeof filters.seriesTagIds === 'string' ? filters.seriesTagIds : undefined,
          seriesQualityProfileIds:
            typeof filters.seriesQualityProfileIds === 'string'
              ? filters.seriesQualityProfileIds
              : undefined,
          seriesGenres: typeof filters.seriesGenres === 'string' ? filters.seriesGenres : undefined,
          seriesType: typeof filters.seriesType === 'string' ? filters.seriesType : undefined,
          network: typeof filters.network === 'string' ? filters.network : undefined,
        });
        itemCount = matched.length;
        const handler = SONARR_TASKS[taskId];
        if (handler) {
          await handler(
            sonarr,
            matched.map((s) => s.id)
          );
        } else {
          return await this.recordUnimplemented(automationId, taskId, provider.type);
        }
      } else {
        log.warn('Provider type not yet supported for execution', {
          providerType: provider.type,
          automationId,
        });
        await this.recordResult(automationId, {
          itemCount: 0,
          status: 'error',
          error: `Provider type "${provider.type}" is not yet supported`,
        });
        return;
      }

      await this.recordResult(automationId, { itemCount, status: 'success' });
      log.info('Automation executed', { automationId, taskId, itemCount });
    } catch (err) {
      log.error('Automation execution failed', { automationId, err });
      await this.recordResult(automationId, {
        itemCount,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  private async recordResult(
    automationId: number,
    result: { itemCount: number; status: 'success' | 'error'; error?: string }
  ): Promise<void> {
    await Promise.all([
      this.automationService.recordRun(automationId, result),
      this.automationRunService.createRun({
        automationId,
        status: result.status,
        itemCount: result.itemCount,
        error: result.error,
      }),
    ]);
  }

  private async recordUnimplemented(
    automationId: number,
    taskId: string,
    providerType: string
  ): Promise<void> {
    log.warn('Task not yet implemented', { taskId, automationId, providerType });
    await this.recordResult(automationId, {
      itemCount: 0,
      status: 'error',
      error: `Task "${taskId}" is not yet implemented`,
    });
  }
}

// ---------------------------------------------------------------------------
// Dispatch tables
// ---------------------------------------------------------------------------

type RadarrTaskFn = (provider: RadarrProvider, ids: number[]) => Promise<void>;
type SonarrTaskFn = (provider: SonarrProvider, ids: number[]) => Promise<void>;

const RADARR_TASKS: Record<string, RadarrTaskFn> = {
  unmonitorMovie: (provider, ids) => provider.unmonitorMovies(ids),
  triggerSearch: (provider, ids) => provider.triggerMoviesSearch(ids),
};

const SONARR_TASKS: Record<string, SonarrTaskFn> = {
  unmonitorSeries: (provider, ids) => provider.unmonitorSeries(ids),
  triggerSearch: (provider, ids) => provider.triggerSeriesSearch(ids),
};

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function coerceBool(v: string | number | boolean | undefined): boolean | undefined {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return undefined;
}
