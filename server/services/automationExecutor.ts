import ky from 'ky';
import { applyMovieFilters, applySeriesFilters } from '../modules/media/media.handler';
import { MetadataProviderType } from '../database/schema';
import { getChildLogger } from '../logger';
import type { AutomationService } from './automationService';
import type { ProviderSettingsService } from './providerSettingsService';
import type { SavedQueryService } from './savedQueryService';

const log = getChildLogger('AutomationExecutor');

interface ExecutorDeps {
  automationService: AutomationService;
  providerSettingsService: ProviderSettingsService;
  savedQueryService: SavedQueryService;
}

export class AutomationExecutor {
  private readonly automationService: AutomationService;
  private readonly providerSettingsService: ProviderSettingsService;
  private readonly savedQueryService: SavedQueryService;

  constructor(deps: ExecutorDeps) {
    this.automationService = deps.automationService;
    this.providerSettingsService = deps.providerSettingsService;
    this.savedQueryService = deps.savedQueryService;
  }

  async execute(automationId: number): Promise<void> {
    let itemCount = 0;

    try {
      const automation = await this.automationService.getById(automationId);
      const provider = await this.providerSettingsService.findById(automation.provider.id);
      const query = await this.savedQueryService.findById(automation.query.id);

      const filters = query.filters;
      const taskId = automation.taskId;

      // Build a ky client for the provider
      const apiKey = provider.apiKey ?? '';
      const prefixUrl = provider.url.replace(/\/+$/, '') + '/';
      const client = ky.create({
        prefixUrl,
        timeout: 30000,
        headers: { Accept: 'application/json' },
      });

      if (provider.type === MetadataProviderType.RADARR) {
        const movies = await client
          .get('movie', { searchParams: { apikey: apiKey } })
          .json<Array<{ id: number; title: string; year?: number; hasFile: boolean; monitored: boolean; tmdbId: number; profileId: number; qualityProfileId: number; tags: number[]; folderName: string; path: string; genres?: string[] }>>();

        // Build a moviesQuerySchema-compatible object from filters
        const movieQuery = buildMovieQuery(filters);
        const matched = applyMovieFilters(movies, movieQuery);
        itemCount = matched.length;

        if (taskId === 'unmonitorMovie') {
          await Promise.all(
            matched.map((movie) =>
              client.put(`movie/${movie.id}`, {
                searchParams: { apikey: apiKey },
                json: { ...movie, monitored: false },
              }).json()
            )
          );
        } else if (taskId === 'triggerSearch') {
          const movieIds = matched.map((m) => m.id);
          if (movieIds.length > 0) {
            await client
              .post('command', {
                searchParams: { apikey: apiKey },
                json: { name: 'MoviesSearch', movieIds },
              })
              .json();
          }
        } else {
          log.warn('Task not yet implemented', { taskId, automationId, providerType: provider.type });
          await this.automationService.recordRun(automationId, {
            itemCount: 0,
            status: 'error',
            error: `Task "${taskId}" is not yet implemented`,
          });
          return;
        }
      } else if (provider.type === MetadataProviderType.SONARR) {
        const series = await client
          .get('series', { searchParams: { apikey: apiKey } })
          .json<Array<{ id: number; title: string; year?: number; status: string; monitored: boolean; tvdbId: number; profileId: number; qualityProfileId: number; languageProfileId: number; tags: number[]; path: string; seasons: Array<{ seasonNumber: number; monitored: boolean }>; genres?: string[]; seriesType?: string; network?: string }>>();

        const seriesQuery = buildSeriesQuery(filters);
        const matched = applySeriesFilters(series, seriesQuery);
        itemCount = matched.length;

        if (taskId === 'unmonitorSeries') {
          await Promise.all(
            matched.map((s) =>
              client.put(`series/${s.id}`, {
                searchParams: { apikey: apiKey },
                json: { ...s, monitored: false },
              }).json()
            )
          );
        } else if (taskId === 'triggerSearch') {
          await Promise.all(
            matched.map((s) =>
              client
                .post('command', {
                  searchParams: { apikey: apiKey },
                  json: { name: 'SeriesSearch', seriesId: s.id },
                })
                .json()
            )
          );
        } else {
          log.warn('Task not yet implemented', { taskId, automationId, providerType: provider.type });
          await this.automationService.recordRun(automationId, {
            itemCount: 0,
            status: 'error',
            error: `Task "${taskId}" is not yet implemented`,
          });
          return;
        }
      } else {
        log.warn('Provider type not yet supported for execution', {
          providerType: provider.type,
          automationId,
        });
        await this.automationService.recordRun(automationId, {
          itemCount: 0,
          status: 'error',
          error: `Provider type "${provider.type}" is not yet supported`,
        });
        return;
      }

      await this.automationService.recordRun(automationId, { itemCount, status: 'success' });
      log.info('Automation executed', { automationId, taskId, itemCount });
    } catch (err) {
      log.error('Automation execution failed', { automationId, err });
      await this.automationService.recordRun(automationId, {
        itemCount,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Filter adapter helpers
// ---------------------------------------------------------------------------

type MovieQuery = Parameters<typeof applyMovieFilters>[1];
type SeriesQuery = Parameters<typeof applySeriesFilters>[1];

function buildMovieQuery(filters: Record<string, unknown>): MovieQuery {
  return {
    page: 1,
    pageSize: 10000,
    sort: 'title_asc',
    title: typeof filters.title === 'string' ? filters.title : undefined,
    yearMin: typeof filters.yearMin === 'number' ? filters.yearMin : undefined,
    yearMax: typeof filters.yearMax === 'number' ? filters.yearMax : undefined,
    hasFile:
      filters.hasFile === 'true' ? true : filters.hasFile === 'false' ? false : undefined,
    movieTagIds: typeof filters.movieTagIds === 'string' ? filters.movieTagIds : undefined,
    movieQualityProfileIds:
      typeof filters.movieQualityProfileIds === 'string'
        ? filters.movieQualityProfileIds
        : undefined,
    movieGenres: typeof filters.movieGenres === 'string' ? filters.movieGenres : undefined,
  } as MovieQuery;
}

function buildSeriesQuery(filters: Record<string, unknown>): SeriesQuery {
  return {
    page: 1,
    pageSize: 10000,
    sort: 'title_asc',
    title: typeof filters.title === 'string' ? filters.title : undefined,
    yearMin: typeof filters.yearMin === 'number' ? filters.yearMin : undefined,
    yearMax: typeof filters.yearMax === 'number' ? filters.yearMax : undefined,
    monitored:
      filters.monitored === 'true' ? true : filters.monitored === 'false' ? false : undefined,
    seriesStatus: typeof filters.seriesStatus === 'string' ? filters.seriesStatus : undefined,
    seriesTagIds:
      typeof filters.seriesTagIds === 'string' ? filters.seriesTagIds : undefined,
    seriesQualityProfileIds:
      typeof filters.seriesQualityProfileIds === 'string'
        ? filters.seriesQualityProfileIds
        : undefined,
    seriesGenres:
      typeof filters.seriesGenres === 'string' ? filters.seriesGenres : undefined,
    seriesType: typeof filters.seriesType === 'string' ? filters.seriesType : undefined,
    network: typeof filters.network === 'string' ? filters.network : undefined,
  } as SeriesQuery;
}
