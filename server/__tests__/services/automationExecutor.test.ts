import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { MetadataProviderType, mediaEnrichment, mediaIdentity } from '@server/database/schema';
import type { IProviderFactory } from '@server/providers/providerFactory';
import type { RadarrProvider } from '@server/providers/radarrProvider';
import type { SonarrProvider } from '@server/providers/sonarrProvider';
import { AutomationExecutor } from '@server/services/automationExecutor';
import { AutomationRunService } from '@server/services/automationRunService';
import { AutomationService } from '@server/services/automationService';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { SavedQueryService } from '@server/services/savedQueryService';
import type { FilterValueEntry } from '@server/services/savedQueryService';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRadarrMovie, createSonarrSeries } from '../../../tests/factories';
import { server } from '../../../tests/mocks/server';

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 5057,
  COMMIT_TAG: 'test',
  LOG_LEVEL: 'error',
  LOG_DIR: './config/logs',
  DB_PATH: ':memory:',
  DB_LOGGING: false,
  TRUST_PROXY: false,
  TMDB_API_KEY: '',
  SESSION_SECRET: 'test-secret',
};

const RADARR_URL = 'http://localhost:7878';
const SONARR_URL = 'http://localhost:8989';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

async function seedRadarrProvider(providerSettingsService: ProviderSettingsService) {
  return providerSettingsService.create({
    type: MetadataProviderType.RADARR,
    name: 'Test Radarr',
    url: `${RADARR_URL}/api/v3`,
    apiKey: 'test-api-key',
  });
}

async function seedSonarrProvider(providerSettingsService: ProviderSettingsService) {
  return providerSettingsService.create({
    type: MetadataProviderType.SONARR,
    name: 'Test Sonarr',
    url: `${SONARR_URL}/api/v3`,
    apiKey: 'test-api-key',
  });
}

async function seedSavedQuery(
  savedQueryService: SavedQueryService,
  filterValues: FilterValueEntry[] = [],
  contentType: 'movie' | 'show' = 'movie'
) {
  return savedQueryService.create({ name: 'Test Query', contentType, filterValues });
}

async function seedAutomation(
  automationService: AutomationService,
  opts: { queryId: number; providerId: number; taskId: string }
) {
  return automationService.create({
    name: 'Test Automation',
    queryId: opts.queryId,
    providerId: opts.providerId,
    taskId: opts.taskId,
    schedule: '0 * * * *',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AutomationExecutor', () => {
  let automationService: AutomationService;
  let providerSettingsService: ProviderSettingsService;
  let savedQueryService: SavedQueryService;
  let executor: AutomationExecutor;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    const db = getDb();
    automationService = new AutomationService({ db });
    providerSettingsService = new ProviderSettingsService({ db });
    savedQueryService = new SavedQueryService({ db });
    executor = new AutomationExecutor({
      automationService,
      automationRunService: new AutomationRunService({ db }),
      providerSettingsService,
      savedQueryService,
    });
  });

  afterEach(async () => {
    await _resetDatabase();
    server.resetHandlers();
  });

  // ─── RADARR: unmonitorMovie ───────────────────────────────────────────────

  describe('RADARR — unmonitorMovie', () => {
    it('sends PUT /movie/{id} with monitored:false for each matched movie', async () => {
      const monitoredMovies = [
        createRadarrMovie({ id: 1, title: 'The Matrix', year: 1999, hasFile: true }),
        createRadarrMovie({ id: 2, title: 'Interstellar', year: 2014, hasFile: true }),
      ];

      const unmonitored: number[] = [];
      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(monitoredMovies)),
        http.put(`${RADARR_URL}/api/v3/movie/:id`, async ({ params, request }) => {
          const body = (await request.json()) as { monitored: boolean };
          if (body.monitored === false) unmonitored.push(Number(params.id));
          return HttpResponse.json({ id: Number(params.id), monitored: false });
        })
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await executor.execute(automation.id);

      expect(unmonitored).toEqual(expect.arrayContaining([1, 2]));
      expect(unmonitored).toHaveLength(2);
    });

    it('applies saved query filters before executing the task', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'The Matrix', year: 1999, hasFile: true }),
        createRadarrMovie({ id: 2, title: 'Inception', year: 2010, hasFile: false }),
      ];

      const unmonitored: number[] = [];
      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
        http.put(`${RADARR_URL}/api/v3/movie/:id`, async ({ params }) => {
          unmonitored.push(Number(params.id));
          return HttpResponse.json({ id: Number(params.id), monitored: false });
        })
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [{ key: 'hasFile', value: true }]);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await executor.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });

    it('applies boolean hasFile:true filter (native boolean, not string)', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'The Matrix', year: 1999, hasFile: true }),
        createRadarrMovie({ id: 2, title: 'Inception', year: 2010, hasFile: false }),
      ];

      const unmonitored: number[] = [];
      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
        http.put(`${RADARR_URL}/api/v3/movie/:id`, async ({ params }) => {
          unmonitored.push(Number(params.id));
          return HttpResponse.json({ id: Number(params.id), monitored: false });
        })
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [{ key: 'hasFile', value: true }]);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await executor.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });

    it('records a successful run with the item count', async () => {
      const movies = [createRadarrMovie({ id: 1, title: 'The Matrix', year: 1999 })];

      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
        http.put(`${RADARR_URL}/api/v3/movie/:id`, () =>
          HttpResponse.json({ id: 1, monitored: false })
        )
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await executor.execute(automation.id);

      const updated = await automationService.list();
      const dto = updated.find((a) => a.id === automation.id)!;
      expect(dto.lastRun).toBeDefined();
      expect(dto.lastRun!.status).toBe('success');
      expect(dto.lastRun!.itemCount).toBe(1);
    });

    it('records an error run when the provider call fails', async () => {
      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => new HttpResponse(null, { status: 500 }))
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await executor.execute(automation.id);

      const updated = await automationService.list();
      const dto = updated.find((a) => a.id === automation.id)!;
      expect(dto.lastRun).toBeDefined();
      expect(dto.lastRun!.status).toBe('error');
    });
  });

  // ─── RADARR: triggerSearch ────────────────────────────────────────────────

  describe('RADARR — triggerSearch', () => {
    it('posts MoviesSearch command with all matched movie IDs', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'The Matrix', year: 1999, hasFile: false }),
        createRadarrMovie({ id: 2, title: 'Interstellar', year: 2014, hasFile: false }),
      ];

      let commandBody: unknown = null;
      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
        http.post(`${RADARR_URL}/api/v3/command`, async ({ request }) => {
          commandBody = await request.json();
          return HttpResponse.json({ id: 1 });
        })
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'triggerSearch',
      });

      await executor.execute(automation.id);

      expect(commandBody).toEqual({ name: 'MoviesSearch', movieIds: [1, 2] });
    });

    it('records success with the matched item count', async () => {
      const movies = [createRadarrMovie({ id: 3, title: 'Dune', year: 2021, hasFile: false })];

      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
        http.post(`${RADARR_URL}/api/v3/command`, () => HttpResponse.json({ id: 1 }))
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'triggerSearch',
      });

      await executor.execute(automation.id);

      const [dto] = await automationService.list();
      expect(dto.lastRun!.status).toBe('success');
      expect(dto.lastRun!.itemCount).toBe(1);
    });
  });

  // ─── SONARR: unmonitorSeries ──────────────────────────────────────────────

  describe('SONARR — unmonitorSeries', () => {
    it('sends PUT /series/{id} with monitored:false for each matched series', async () => {
      const seriesList = [
        createSonarrSeries({ id: 1, title: 'Breaking Bad', year: 2008, status: 'ended' }),
        createSonarrSeries({ id: 2, title: 'The Wire', year: 2002, status: 'ended' }),
      ];

      const unmonitored: number[] = [];
      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.put(`${SONARR_URL}/api/v3/series/:id`, async ({ params, request }) => {
          const body = (await request.json()) as { monitored: boolean };
          if (body.monitored === false) unmonitored.push(Number(params.id));
          return HttpResponse.json({ id: Number(params.id), monitored: false });
        })
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [], 'show');
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
      });

      await executor.execute(automation.id);

      expect(unmonitored).toEqual(expect.arrayContaining([1, 2]));
      expect(unmonitored).toHaveLength(2);
    });

    it('applies saved query filters before unmonitoring', async () => {
      const seriesList = [
        createSonarrSeries({ id: 1, title: 'Breaking Bad', year: 2008, status: 'ended' }),
        createSonarrSeries({ id: 2, title: 'Ongoing Show', year: 2020, status: 'continuing' }),
      ];

      const unmonitored: number[] = [];
      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.put(`${SONARR_URL}/api/v3/series/:id`, async ({ params }) => {
          unmonitored.push(Number(params.id));
          return HttpResponse.json({ id: Number(params.id), monitored: false });
        })
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(
        savedQueryService,
        [{ key: 'seriesStatus', value: 'ended' }],
        'show'
      );
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
      });

      await executor.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });

    it('applies boolean monitored:false filter (native boolean, not string)', async () => {
      const seriesList = [
        createSonarrSeries({ id: 1, title: 'Breaking Bad', year: 2008, monitored: false }),
        createSonarrSeries({ id: 2, title: 'Ongoing Show', year: 2020, monitored: true }),
      ];

      const unmonitored: number[] = [];
      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.put(`${SONARR_URL}/api/v3/series/:id`, async ({ params }) => {
          unmonitored.push(Number(params.id));
          return HttpResponse.json({ id: Number(params.id), monitored: false });
        })
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(
        savedQueryService,
        [{ key: 'monitored', value: false }],
        'show'
      );
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
      });

      await executor.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });

    it('records a successful run with the item count', async () => {
      const seriesList = [
        createSonarrSeries({ id: 1, title: 'Breaking Bad', year: 2008, status: 'ended' }),
      ];

      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.put(`${SONARR_URL}/api/v3/series/:id`, () =>
          HttpResponse.json({ id: 1, monitored: false })
        )
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [], 'show');
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
      });

      await executor.execute(automation.id);

      const [dto] = await automationService.list();
      expect(dto.lastRun!.status).toBe('success');
      expect(dto.lastRun!.itemCount).toBe(1);
    });
  });

  // ─── SONARR: triggerSearch ────────────────────────────────────────────────

  describe('SONARR — triggerSearch', () => {
    it('posts SeriesSearch command for each matched series ID', async () => {
      const seriesList = [
        createSonarrSeries({ id: 1, title: 'Breaking Bad', year: 2008, status: 'ended' }),
        createSonarrSeries({ id: 2, title: 'The Wire', year: 2002, status: 'ended' }),
      ];

      const commandBodies: unknown[] = [];
      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.post(`${SONARR_URL}/api/v3/command`, async ({ request }) => {
          commandBodies.push(await request.json());
          return HttpResponse.json({ id: 1 });
        })
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [], 'show');
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'triggerSearch',
      });

      await executor.execute(automation.id);

      expect(commandBodies).toHaveLength(2);
      expect(commandBodies).toEqual(
        expect.arrayContaining([
          { name: 'SeriesSearch', seriesId: 1 },
          { name: 'SeriesSearch', seriesId: 2 },
        ])
      );
    });

    it('records success with the matched item count', async () => {
      const seriesList = [
        createSonarrSeries({ id: 5, title: 'Severance', year: 2022, status: 'continuing' }),
      ];

      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.post(`${SONARR_URL}/api/v3/command`, () => HttpResponse.json({ id: 1 }))
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [], 'show');
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'triggerSearch',
      });

      await executor.execute(automation.id);

      const [dto] = await automationService.list();
      expect(dto.lastRun!.status).toBe('success');
      expect(dto.lastRun!.itemCount).toBe(1);
    });
  });

  // ─── Unimplemented tasks ──────────────────────────────────────────────────

  describe('unimplemented tasks', () => {
    it('records an error run for a destructive task that is not yet implemented', async () => {
      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'deleteMovieWithFiles',
      });

      await executor.execute(automation.id);

      const [dto] = await automationService.list();
      expect(dto.lastRun).toBeDefined();
      expect(dto.lastRun!.status).toBe('error');
      expect(dto.lastRun!.error).toMatch(/not yet implemented/i);
    });
  });

  // ─── Injected factory ────────────────────────────────────────────────────

  describe('injected ProviderFactory', () => {
    it('calls factory.create() and executes the task — no HTTP stub needed', async () => {
      const movies = [createRadarrMovie({ id: 10, title: 'Dune', year: 2021 })];
      const unmonitored: number[] = [];

      const mockRadarr = {
        getMovies: async () => movies,
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;

      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      const executorWithFactory = new AutomationExecutor({
        automationService,
        providerSettingsService,
        savedQueryService,
        providerFactory: mockFactory,
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await executorWithFactory.execute(automation.id);

      expect(unmonitored).toEqual([10]);
    });

    it('routes factory.create() to the correct provider type for Sonarr', async () => {
      const seriesList = [createSonarrSeries({ id: 5, title: 'The Wire', year: 2002 })];
      const unmonitored: number[] = [];

      const mockSonarr = {
        getSeries: async () => seriesList,
        unmonitorSeries: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerSeriesSearch: async () => {},
      } as unknown as SonarrProvider;

      const mockFactory: IProviderFactory = { create: () => mockSonarr };

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [], 'show');
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
      });

      const executorWithFactory = new AutomationExecutor({
        automationService,
        providerSettingsService,
        savedQueryService,
        providerFactory: mockFactory,
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await executorWithFactory.execute(automation.id);

      expect(unmonitored).toEqual([5]);
    });
  });

  // ─── contentType discriminator ───────────────────────────────────────────

  describe('contentType discriminator', () => {
    it('routes to the movie path when query.contentType is "movie"', async () => {
      const movies = [createRadarrMovie({ id: 7, title: 'Dune', year: 2021 })];
      const unmonitored: number[] = [];

      const mockRadarr = {
        getMovies: async () => movies,
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;

      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const mockAutomationService = {
        getById: async () => ({
          id: 99,
          name: 'Discriminator Test',
          kind: 'user' as const,
          query: { id: 1, name: 'Q', contentType: 'movie' as const },
          provider: { id: 1, name: 'Radarr', type: 'RADARR' },
          taskId: 'unmonitorMovie',
          schedule: '0 * * * *',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        recordRun: vi.fn(),
      };

      const mockSavedQueryService = {
        getById: async () => ({
          id: 1,
          name: 'Q',
          contentType: 'movie' as const,
          filterValues: [],
          health: { status: 'healthy' as const, providerStatus: [] },
          createdAt: new Date().toISOString(),
        }),
      };

      const mockProviderSettingsService = {
        findById: async () => ({
          id: 1,
          type: 'RADARR',
          name: 'Radarr',
          url: 'http://localhost:7878',
          apiKey: null,
          settings: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const executorWithMocks = new AutomationExecutor({
        automationService: mockAutomationService as any,
        savedQueryService: mockSavedQueryService as any,
        providerSettingsService: mockProviderSettingsService as any,
        providerFactory: mockFactory,
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await executorWithMocks.execute(99);

      expect(unmonitored).toEqual([7]);
    });
  });

  // ─── Tier 2 enrichment filtering ─────────────────────────────────────────

  describe('Tier 2 enrichment — watched filter uses tautulliPlayCount from DB', () => {
    it('only executes task on movies whose enrichment row shows playCount > 0', async () => {
      const db = getDb();

      const movies = [
        createRadarrMovie({ id: 1, title: 'Watched Movie', hasFile: true }),
        createRadarrMovie({ id: 2, title: 'Unwatched Movie', hasFile: true }),
      ];

      // Seed media_identity + enrichment for movie 1 only (tautulliPlayCount=3)
      const [identity] = await db
        .insert(mediaIdentity)
        .values({ sourceType: 'RADARR', sourceId: 1 })
        .returning();
      await db.insert(mediaEnrichment).values({
        mediaIdentityId: identity.id,
        tautulliPlayCount: 3,
        enrichedAt: Math.floor(Date.now() / 1000),
      });

      const unmonitored: number[] = [];
      const mockRadarr = {
        getMovies: async () => movies,
        unmonitorMovies: async (ids: number[]) => { unmonitored.push(...ids); },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;
      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, [{ key: 'watched', value: true }]);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      const enrichedExecutor = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        savedQueryService,
        providerFactory: mockFactory,
        db,
      });

      await enrichedExecutor.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });
  });

  // ─── Scheduler wiring ────────────────────────────────────────────────────

  describe('AutomationScheduler integration', () => {
    it('calls executor.execute when a scheduled tick fires', async () => {
      const { AutomationScheduler } = await import('@server/cron/automationScheduler');

      let executedId: number | null = null;
      const mockExecutor = {
        execute: async (id: number) => {
          executedId = id;
        },
      };

      const scheduler = new AutomationScheduler({ automationExecutor: mockExecutor });
      scheduler.schedule({ id: 42, name: 'Test', schedule: '* * * * *' });

      await scheduler.trigger(42);
      scheduler.stopAll();

      expect(executedId).toBe(42);
    });
  });
});
