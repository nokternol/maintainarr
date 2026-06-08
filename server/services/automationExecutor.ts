import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { mediaEnrichment, mediaIdentity } from '../database/schema';
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
import type { AutomationService } from './automationService';
import type { ProviderSettingsService } from './providerSettingsService';
import type { FilterValueEntry } from './savedQueryService';
import type { SavedQueryService } from './savedQueryService';

const log = getChildLogger('AutomationExecutor');

interface ExecutorDeps {
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  providerSettingsService: ProviderSettingsService;
  savedQueryService: SavedQueryService;
  providerFactory?: IProviderFactory;
  db?: DrizzleDb;
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

  constructor(deps: ExecutorDeps) {
    this.automationService = deps.automationService;
    this.automationRunService = deps.automationRunService;
    this.providerSettingsService = deps.providerSettingsService;
    this.savedQueryService = deps.savedQueryService;
    this.providerFactory = deps.providerFactory ?? new ProviderFactory();
    this.db = deps.db;
  }

  async execute(automationId: number): Promise<void> {
    let itemCount = 0;

    try {
      const automation = await this.automationService.getById(automationId);
      if (!automation.provider || !automation.query) {
        throw new Error(`Automation ${automationId} has no provider or query — cannot execute`);
      }

      const providerSettings = await this.providerSettingsService.findById(automation.provider.id);
      const queryDto = await this.savedQueryService.getById(automation.query.id);
      const { contentType, filterValues } = queryDto;
      const taskId = automation.taskId;

      if (contentType === 'movie') {
        const radarr = this.providerFactory.create(providerSettings, log) as RadarrProvider;
        const movies = await radarr.getMovies();
        const normalized = movies.map(normalizeRadarrMovie);
        if (this.db) {
          await this.mergeMovieEnrichment(
            normalized,
            movies.map((m) => m.id)
          );
        }
        const matched = applyFilters(normalized, filterValues, 'movie');
        itemCount = matched.length;

        const handler = RADARR_TASKS[taskId];
        if (handler) {
          await handler(
            radarr,
            matched.map((m) => m._sourceIds.radarr!)
          );
        } else {
          return await this.recordUnimplemented(automationId, taskId, contentType);
        }
      } else if (contentType === 'show') {
        const sonarr = this.providerFactory.create(providerSettings, log) as SonarrProvider;
        const series = await sonarr.getSeries();
        const normalized = series.map(normalizeSonarrSeries);
        const matched = applyFilters(normalized, filterValues, 'show');
        itemCount = matched.length;

        const handler = SONARR_TASKS[taskId];
        if (handler) {
          await handler(
            sonarr,
            matched.map((s) => s._sourceIds.sonarr!)
          );
        } else {
          return await this.recordUnimplemented(automationId, taskId, contentType);
        }
      } else {
        log.warn('Query contentType not yet supported for execution', {
          contentType,
          automationId,
        });
        await this.recordResult(automationId, {
          itemCount: 0,
          status: 'error',
          error: `Query contentType "${contentType}" is not yet supported`,
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

  private async mergeMovieEnrichment(
    normalized: NormalizedMovie[],
    radarrIds: number[]
  ): Promise<void> {
    if (!this.db || radarrIds.length === 0) return;
    const identities = await this.db
      .select()
      .from(mediaIdentity)
      .where(
        and(eq(mediaIdentity.sourceType, 'RADARR'), inArray(mediaIdentity.sourceId, radarrIds))
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
    const enrichByRadarrId = new Map<number, (typeof enrichments)[number]>();
    for (const enr of enrichments) {
      const sourceId = identityIdToSourceId.get(enr.mediaIdentityId);
      if (sourceId !== undefined) enrichByRadarrId.set(sourceId, enr);
    }
    for (const item of normalized) {
      const radarrId = item._sourceIds.radarr;
      if (radarrId === undefined) continue;
      const enr = enrichByRadarrId.get(radarrId);
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
    contentType: string
  ): Promise<void> {
    log.warn('Task not yet implemented', { taskId, automationId, contentType });
    await this.recordResult(automationId, {
      itemCount: 0,
      status: 'error',
      error: `Task "${taskId}" is not yet implemented`,
    });
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
