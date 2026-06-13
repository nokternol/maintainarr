import type { DrizzleDb } from '../database';
import type { MetadataProvider } from '../database/schema';
import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';
import { getChildLogger } from '../logger';
import { normalizeRadarrMovie, normalizeSonarrSeries } from '../providers/normalizeMedia';
import { type IProviderFactory, ProviderFactory } from '../providers/providerFactory';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';
import { getFilterDef } from '../utils/filterRegistry';
import type { AutomationRunService } from './automationRunService';
import type { AutomationQuerySourceDto, AutomationService } from './automationService';
import { type QueryResult, evaluateCombination } from './combinationEvaluator';
import { mergeEnrichment } from './enrichmentMerge';
import type { ProviderSettingsService } from './providerSettingsService';
import type { FilterValueEntry } from './savedQueryService';
import type { SavedQueryService } from './savedQueryService';

const log = getChildLogger('AutomationExecutor');

export interface SystemTaskRunnerLike {
  run(taskId: string): Promise<number>;
}

interface ExecutorDeps {
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  providerSettingsService: ProviderSettingsService;
  savedQueryService: SavedQueryService;
  providerFactory?: IProviderFactory;
  db?: DrizzleDb;
  systemTaskRunner?: SystemTaskRunnerLike;
}

// ─── Filter application ───────────────────────────────────────────────────────

function applyFilters<T extends NormalizedMovie | NormalizedShow>(
  items: T[],
  filterValues: FilterValueEntry[],
  contentType: 'movie' | 'show'
): T[] {
  if (filterValues.length === 0) return items;
  return items.filter((item) =>
    filterValues.every(({ key, value }) => {
      const def = getFilterDef(key, contentType);
      if (!def) return true;
      return def.apply(item, value);
    })
  );
}

// ─── Executor ─────────────────────────────────────────────────────────────────

export class AutomationExecutor {
  private readonly automationService: AutomationService;
  private readonly automationRunService: AutomationRunService;
  private readonly providerSettingsService: ProviderSettingsService;
  private readonly savedQueryService: SavedQueryService;
  private readonly providerFactory: IProviderFactory;
  private readonly db?: DrizzleDb;
  private readonly systemTaskRunner?: SystemTaskRunnerLike;
  private readonly inFlight = new Set<number>();

  constructor(deps: ExecutorDeps) {
    this.automationService = deps.automationService;
    this.automationRunService = deps.automationRunService;
    this.providerSettingsService = deps.providerSettingsService;
    this.savedQueryService = deps.savedQueryService;
    this.providerFactory = deps.providerFactory ?? new ProviderFactory();
    this.db = deps.db;
    this.systemTaskRunner = deps.systemTaskRunner;
  }

  async execute(automationId: number): Promise<void> {
    if (this.inFlight.has(automationId)) return;
    this.inFlight.add(automationId);

    let itemCount = 0;
    let kind: 'user' | 'system' = 'user';

    try {
      const automation = await this.automationService.getById(automationId);
      kind = automation.kind;

      if (automation.kind === 'system') {
        if (!this.systemTaskRunner) {
          throw new Error('System automation requires a systemTaskRunner');
        }
        itemCount = await this.systemTaskRunner.run(automation.taskId);
        await this.recordResult(automationId, { itemCount, status: 'success', kind });
        log.info('System automation executed', {
          automationId,
          taskId: automation.taskId,
          itemCount,
        });
        return;
      }

      if (!automation.provider) {
        throw new Error(`Automation ${automationId} has no provider — cannot execute`);
      }

      const sources = automation.querySources ?? [];

      if (!sources.length) {
        throw new Error(`Automation ${automationId} has no query sources — cannot execute`);
      }

      const providerSettings = await this.providerSettingsService.findById(automation.provider.id);
      itemCount = await this.executeWithSources(automation.taskId, providerSettings, sources);
      await this.recordResult(automationId, { itemCount, status: 'success', kind });
      log.info('Automation executed', { automationId, taskId: automation.taskId, itemCount });
    } catch (err) {
      log.error('Automation execution failed', { automationId, err });
      await this.recordResult(automationId, {
        itemCount,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        kind,
      });
    } finally {
      this.inFlight.delete(automationId);
    }
  }

  private async executeWithSources(
    taskId: string,
    providerSettings: MetadataProvider,
    sources: AutomationQuerySourceDto[]
  ): Promise<number> {
    const queryDtos = await Promise.all(
      sources.map((s) => this.savedQueryService.getById(s.queryId))
    );
    const contentType = queryDtos[0].contentType;
    const provider = this.providerFactory.create(providerSettings, log);
    const queryResults: QueryResult[] = [];

    if (contentType === 'movie') {
      const radarr = provider as RadarrProvider;
      const movies = await radarr.getMovies();
      const normalized = movies.map(normalizeRadarrMovie);
      if (this.db) await mergeEnrichment(this.db, normalized, 'RADARR', (m) => m._sourceIds.radarr);
      for (let i = 0; i < sources.length; i++) {
        const matched = applyFilters(normalized, queryDtos[i].filterValues, 'movie');
        queryResults.push({
          role: sources[i].role,
          items: matched.map((m) => m._sourceIds.radarr!),
        });
      }
      const finalIds = evaluateCombination(queryResults).map(Number);
      const handler = RADARR_TASKS[taskId];
      if (!handler) throw new Error(`Task "${taskId}" is not yet implemented`);
      await handler(radarr, finalIds);
      return finalIds.length;
    }

    if (contentType === 'show') {
      const sonarr = provider as SonarrProvider;
      const series = await sonarr.getSeries();
      const normalized = series.map(normalizeSonarrSeries);
      if (this.db) await mergeEnrichment(this.db, normalized, 'SONARR', (s) => s._sourceIds.sonarr);
      for (let i = 0; i < sources.length; i++) {
        const matched = applyFilters(normalized, queryDtos[i].filterValues, 'show');
        queryResults.push({
          role: sources[i].role,
          items: matched.map((s) => s._sourceIds.sonarr!),
        });
      }
      const finalIds = evaluateCombination(queryResults).map(Number);
      const handler = SONARR_TASKS[taskId];
      if (!handler) throw new Error(`Task "${taskId}" is not yet implemented`);
      await handler(sonarr, finalIds);
      return finalIds.length;
    }

    return 0;
  }

  private async recordResult(
    automationId: number,
    result: {
      itemCount: number;
      status: 'success' | 'error';
      error?: string;
      kind: 'user' | 'system';
    }
  ): Promise<void> {
    await Promise.all([
      this.automationService.recordRun(automationId, result),
      this.automationRunService.createRun({
        automationId,
        status: result.status,
        itemCount: result.itemCount,
        error: result.error,
        kind: result.kind,
      }),
    ]);
  }
}

// ─── Dispatch tables ──────────────────────────────────────────────────────────

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
