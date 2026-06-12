import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { mediaEnrichment, mediaIdentity } from '../database/schema';
import type { MetadataProvider } from '../database/schema';
import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';
import { getChildLogger } from '../logger';
import { type IProviderFactory, ProviderFactory } from '../providers/providerFactory';
import type { RadarrMovie } from '../providers/radarrProvider';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrSeries } from '../providers/sonarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';
import { getFilterDef } from '../utils/filterRegistry';
import type { AutomationRunService } from './automationRunService';
import type { AutomationQuerySourceDto, AutomationService } from './automationService';
import { type QueryResult, evaluateCombination } from './combinationEvaluator';
import type { ProviderSettingsService } from './providerSettingsService';
import type { FilterValueEntry } from './savedQueryService';
import type { SavedQueryService } from './savedQueryService';

const log = getChildLogger('AutomationExecutor');

export interface SystemTaskRunnerLike {
  run(taskId: string): Promise<void>;
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

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeRadarrMovie(m: RadarrMovie): NormalizedMovie {
  return {
    _sourceIds: { radarr: m.id },
    title: m.title,
    year: m.year,
    hasFile: m.hasFile,
    monitored: m.monitored,
    qualityProfileId: m.qualityProfileId,
    tags: m.tags,
    genres: m.genres,
    addedDate: m.added,
    sizeOnDiskBytes: m.statistics?.sizeOnDisk,
    certification: m.certification,
    imdbRating: m.ratings?.imdb?.value,
  };
}

function normalizeSonarrSeries(s: SonarrSeries): NormalizedShow {
  return {
    _sourceIds: { sonarr: s.id },
    title: s.title,
    year: s.year,
    monitored: s.monitored,
    qualityProfileId: s.qualityProfileId,
    tags: s.tags,
    genres: s.genres,
    addedDate: s.added,
    sizeOnDiskBytes: s.statistics?.sizeOnDisk,
    certification: s.certification,
    seriesType: s.seriesType as NormalizedShow['seriesType'],
    network: s.network,
    status: s.status as NormalizedShow['status'],
    ended: s.ended,
    episodePercentage: s.statistics?.percentOfEpisodes,
    lastAiredAt: s.previousAiring,
    communityRating: s.ratings?.value,
  };
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
    let itemCount = 0;
    let kind: 'user' | 'system' = 'user';

    try {
      const automation = await this.automationService.getById(automationId);
      kind = automation.kind;

      if (automation.kind === 'system') {
        if (!this.systemTaskRunner) {
          throw new Error('System automation requires a systemTaskRunner');
        }
        await this.systemTaskRunner.run(automation.taskId);
        await this.recordResult(automationId, { itemCount: 0, status: 'success', kind });
        log.info('System automation executed', { automationId, taskId: automation.taskId });
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
      if (this.db)
        await this.mergeEnrichment(
          normalized,
          movies.map((m) => m.id),
          'RADARR',
          (m) => m._sourceIds.radarr
        );
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
      if (this.db)
        await this.mergeEnrichment(
          normalized,
          series.map((s) => s.id),
          'SONARR',
          (s) => s._sourceIds.sonarr
        );
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

  private async mergeEnrichment<T extends NormalizedMovie | NormalizedShow>(
    normalized: T[],
    sourceIds: number[],
    sourceType: 'RADARR' | 'SONARR',
    getSourceId: (item: T) => number | undefined
  ): Promise<void> {
    if (!this.db || sourceIds.length === 0) return;
    const identities = await this.db
      .select()
      .from(mediaIdentity)
      .where(
        and(eq(mediaIdentity.sourceType, sourceType), inArray(mediaIdentity.sourceId, sourceIds))
      );
    if (identities.length === 0) return;
    const identityIdToSourceId = new Map(identities.map((i) => [i.id, i.sourceId]));
    const enrichments = await this.db
      .select()
      .from(mediaEnrichment)
      .where(
        inArray(
          mediaEnrichment.mediaIdentityId,
          identities.map((i) => i.id)
        )
      );
    const enrichBySourceId = new Map<number, (typeof enrichments)[number]>();
    for (const enr of enrichments) {
      const sourceId = identityIdToSourceId.get(enr.mediaIdentityId);
      if (sourceId !== undefined) enrichBySourceId.set(sourceId, enr);
    }
    for (const item of normalized) {
      const id = getSourceId(item);
      if (id === undefined) continue;
      const enr = enrichBySourceId.get(id);
      if (!enr) continue;
      const rawPlay = enr.tautulliPlayCount ?? enr.plexViewCount ?? null;
      item.playCount = rawPlay !== null ? rawPlay : undefined;
      const rawTs = enr.tautulliLastPlayed ?? enr.plexLastViewedAt ?? null;
      item.lastWatchedAt = rawTs !== null ? new Date(rawTs * 1000).toISOString() : undefined;
      if (enr.overseerrHasIssue !== null) item.overseerrHasIssue = enr.overseerrHasIssue;
      if (enr.overseerrRequestStatus !== null)
        item.overseerrRequestStatus = enr.overseerrRequestStatus;
      if (enr.tmdbStatus !== null) item.tmdbStatus = enr.tmdbStatus ?? undefined;
    }
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
