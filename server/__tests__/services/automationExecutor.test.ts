import {
  MetadataProviderType,
  automationRuns,
  automations,
  mediaEnrichment,
  mediaIdentity,
} from '@server/database/schema';
import type { NormalizedMovie } from '@server/domain/movie';
import type { NormalizedShow } from '@server/domain/show';
import type { AppConfig } from '@server/kernel/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/kernel/db';
import { DomainEventBus, type DomainEvents } from '@server/kernel/eventBus';
import { getChildLogger } from '@server/kernel/logger';
import {
  type IProviderFactory,
  ProviderSettingsService,
  type RadarrMovie,
  RadarrProvider,
  SonarrProvider,
  type SonarrSeries,
} from '@server/modules/providers';
import { normalizeRadarrMovie, normalizeSonarrSeries } from '@server/providers/normalizeMedia';
import { AutomationExecutor } from '@server/services/automationExecutor';
import { AutomationRunService } from '@server/services/automationRunService';
import { AutomationService } from '@server/services/automationService';
import { MediaQueryService } from '@server/services/mediaQueryService';
import type { FilterValueEntry } from '@server/services/mediaQueryService';
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

/**
 * The `MediaSource` + `MediaActuator` roles the executor consumes, over a raw
 * provider list. `tasks()` binds each runner to `this`, so a mock built by
 * spreading this helper plus its action methods dispatches through the instance
 * exactly as a real provider does.
 */
const radarrSource = (movies: RadarrMovie[]) => ({
  getMediaItems: async () => movies.map(normalizeRadarrMovie),
  idOf: (item: NormalizedMovie | NormalizedShow) => (item as NormalizedMovie)._sourceIds.radarr,
  enrichmentSourceType: 'RADARR' as const,
  tasks(this: {
    unmonitorMovies(ids: number[]): Promise<void>;
    triggerMoviesSearch(ids: number[]): Promise<void>;
  }) {
    return [
      {
        id: 'unmonitorMovie',
        label: 'Unmonitor movie',
        destructive: false,
        affects: 'media' as const,
        run: (ids: number[]) => this.unmonitorMovies(ids),
      },
      {
        id: 'triggerSearch',
        label: 'Trigger download search',
        destructive: false,
        run: (ids: number[]) => this.triggerMoviesSearch(ids),
      },
    ];
  },
});

const sonarrSource = (series: SonarrSeries[]) => ({
  getMediaItems: async () => series.map(normalizeSonarrSeries),
  idOf: (item: NormalizedMovie | NormalizedShow) => (item as NormalizedShow)._sourceIds.sonarr,
  enrichmentSourceType: 'SONARR' as const,
  tasks(this: {
    unmonitorSeries(ids: number[]): Promise<void>;
    triggerSeriesSearch(ids: number[]): Promise<void>;
  }) {
    return [
      {
        id: 'unmonitorSeries',
        label: 'Unmonitor series',
        destructive: false,
        affects: 'media' as const,
        run: (ids: number[]) => this.unmonitorSeries(ids),
      },
      {
        id: 'triggerSearch',
        label: 'Trigger episode search',
        destructive: false,
        run: (ids: number[]) => this.triggerSeriesSearch(ids),
      },
    ];
  },
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

async function seedRadarrProvider(providerSettingsService: ProviderSettingsService) {
  return providerSettingsService.create({
    type: MetadataProviderType.RADARR,
    name: 'Test Radarr',
    url: `${RADARR_URL}/api/v3`,
    apiKey: 'test-api-key',
    settings: { enabledTasks: ['unmonitorMovie', 'triggerSearch', 'deleteMovieWithFiles'] },
  });
}

async function seedSonarrProvider(providerSettingsService: ProviderSettingsService) {
  return providerSettingsService.create({
    type: MetadataProviderType.SONARR,
    name: 'Test Sonarr',
    url: `${SONARR_URL}/api/v3`,
    apiKey: 'test-api-key',
    settings: { enabledTasks: ['unmonitorSeries', 'triggerSearch', 'deleteSeriesWithFiles'] },
  });
}

async function seedMediaQuery(
  mediaQueryService: MediaQueryService,
  filterValues: FilterValueEntry[] = [],
  contentType: 'movie' | 'show' = 'movie'
) {
  return mediaQueryService.create({ name: 'Test Query', contentType, filterValues });
}

async function seedAutomation(
  automationService: AutomationService,
  opts: { queryId: number; providerId: number; taskId: string }
) {
  return automationService.create({
    name: 'Test Automation',
    querySources: [{ queryId: opts.queryId, role: 'include' }],
    providerId: opts.providerId,
    taskId: opts.taskId,
    schedule: '0 * * * *',
  });
}

async function seedSystemTask(taskId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .insert(automations)
    .values({ name: `sys:${taskId}`, taskId, schedule: '0 * * * *', kind: 'system' })
    .returning();
  return row.id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AutomationExecutor', () => {
  let automationService: AutomationService;
  let providerSettingsService: ProviderSettingsService;
  let mediaQueryService: MediaQueryService;
  let executor: AutomationExecutor;

  beforeEach(async () => {
    await initializeDatabase(testConfig);
    const db = getDb();
    automationService = new AutomationService({ db });
    providerSettingsService = new ProviderSettingsService({ db });
    mediaQueryService = new MediaQueryService({ db });
    executor = new AutomationExecutor({
      automationService,
      automationRunService: new AutomationRunService({ db }),
      providerSettingsService,
      mediaQueryService,
    });
  });

  afterEach(async () => {
    await _resetDatabase();
    server.resetHandlers();
  });

  // ─── SYSTEM: kind-based dispatch ──────────────────────────────────────────

  describe('SYSTEM — kind dispatch', () => {
    async function seedSystemAutomation(taskId: string): Promise<number> {
      const db = getDb();
      const [row] = await db
        .insert(automations)
        .values({ name: `sys:${taskId}`, taskId, schedule: '0 * * * *', kind: 'system' })
        .returning();
      return row.id;
    }

    it('runs the system task and records a success run with kind=system, without the provider path', async () => {
      const db = getDb();
      const run = vi.fn(async () => 0);
      const systemExecutor = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: { run },
      });
      const id = await seedSystemAutomation('system:identity-resolution');

      await systemExecutor.execute(id);

      expect(run).toHaveBeenCalledWith('system:identity-resolution');
      const runs = await db.select().from(automationRuns);
      expect(runs).toHaveLength(1);
      expect(runs[0].status).toBe('success');
      expect(runs[0].kind).toBe('system');
    });

    it('records the runner-reported changed count as itemCount, not a hardcoded 0', async () => {
      const db = getDb();
      const run = vi.fn(async () => 5);
      const systemExecutor = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: { run },
      });
      const id = await seedSystemAutomation('system:enrichment');

      await systemExecutor.execute(id);

      const runs = await db.select().from(automationRuns);
      expect(runs).toHaveLength(1);
      expect(runs[0].itemCount).toBe(5);
    });

    it('does not start a second run while a run for the same id is in flight', async () => {
      const db = getDb();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const run = vi.fn(async () => {
        await gate;
        return 0;
      });
      const guardedExecutor = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: { run },
      });
      const id = await seedSystemAutomation('system:identity-resolution');

      const first = guardedExecutor.execute(id);
      const second = guardedExecutor.execute(id);
      release();
      await Promise.all([first, second]);

      expect(run).toHaveBeenCalledTimes(1);
      const runs = await db.select().from(automationRuns);
      expect(runs).toHaveLength(1);
    });
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
      const query = await seedMediaQuery(mediaQueryService, []);
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
      const query = await seedMediaQuery(mediaQueryService, [{ key: 'hasFile', value: true }]);
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
      const query = await seedMediaQuery(mediaQueryService, [{ key: 'hasFile', value: true }]);
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
      const query = await seedMediaQuery(mediaQueryService, []);
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
      const query = await seedMediaQuery(mediaQueryService, []);
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

  // ─── Enablement enforcement at run time ───────────────────────────────────

  describe('per-instance enablement enforcement', () => {
    it('records an error run for a task no longer enabled on the instance, without calling the provider', async () => {
      let movieEndpointHit = false;
      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => {
          movieEndpointHit = true;
          return HttpResponse.json([createRadarrMovie({ id: 1, title: 'A', hasFile: true })]);
        }),
        http.put(`${RADARR_URL}/api/v3/movie/:id`, () =>
          HttpResponse.json({ id: 1, monitored: false })
        )
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      // The task was enabled at create time; the operator later disables it.
      await providerSettingsService.update(provider.id, { settings: { enabledTasks: [] } });

      await executor.execute(automation.id);

      const [dto] = await automationService.list();
      expect(dto.lastRun!.status).toBe('error');
      expect(dto.lastRun!.error).toMatch(/not enabled/i);
      expect(movieEndpointHit).toBe(false);
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
      const query = await seedMediaQuery(mediaQueryService, []);
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
      const query = await seedMediaQuery(mediaQueryService, []);
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
      const query = await seedMediaQuery(mediaQueryService, [], 'show');
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
      const query = await seedMediaQuery(
        mediaQueryService,
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
      const query = await seedMediaQuery(
        mediaQueryService,
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
      const query = await seedMediaQuery(mediaQueryService, [], 'show');
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
      const query = await seedMediaQuery(mediaQueryService, [], 'show');
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
      const query = await seedMediaQuery(mediaQueryService, [], 'show');
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

  // ─── Injected factory ────────────────────────────────────────────────────

  describe('injected ProviderFactory', () => {
    it('calls factory.create() and executes the task — no HTTP stub needed', async () => {
      const movies = [createRadarrMovie({ id: 10, title: 'Dune', year: 2021 })];
      const unmonitored: number[] = [];

      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;

      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      const executorWithFactory = new AutomationExecutor({
        automationService,
        providerSettingsService,
        mediaQueryService,
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
        ...sonarrSource(seriesList),
        unmonitorSeries: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerSeriesSearch: async () => {},
      } as unknown as SonarrProvider;

      const mockFactory: IProviderFactory = { create: () => mockSonarr };

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, [], 'show');
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
      });

      const executorWithFactory = new AutomationExecutor({
        automationService,
        providerSettingsService,
        mediaQueryService,
        providerFactory: mockFactory,
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await executorWithFactory.execute(automation.id);

      expect(unmonitored).toEqual([5]);
    });
  });

  // ─── Legacy path removal ─────────────────────────────────────────────────

  describe('legacy path removal', () => {
    it('records error when querySources is empty even if a legacy query field is defined', async () => {
      const movies = [createRadarrMovie({ id: 7, title: 'Dune', year: 2021 })];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async (_: number[]) => {},
      } as unknown as RadarrProvider;

      const recordRun = vi.fn();
      const mockAutomationService = {
        getById: async () => ({
          id: 99,
          name: 'Legacy Path Test',
          kind: 'user' as const,
          querySources: [],
          query: { id: 1, name: 'Q', contentType: 'movie' as const },
          provider: { id: 1, name: 'Radarr', type: 'RADARR' },
          taskId: 'unmonitorMovie',
          schedule: '0 * * * *',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        recordRun,
      };

      const mockMediaQueryService = {
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
          settings: { enabledTasks: ['unmonitorMovie'] },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const legacyExecutor = new AutomationExecutor({
        automationService: mockAutomationService as unknown as AutomationService,
        mediaQueryService: mockMediaQueryService as unknown as MediaQueryService,
        providerSettingsService: mockProviderSettingsService as unknown as ProviderSettingsService,
        providerFactory: { create: () => mockRadarr },
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await legacyExecutor.execute(99);

      expect(recordRun).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          status: 'error',
          error: expect.stringMatching(/no query sources/i),
        })
      );
    });
  });

  // ─── contentType discriminator ───────────────────────────────────────────

  describe('contentType discriminator', () => {
    it('routes to the movie path when query.contentType is "movie"', async () => {
      const movies = [createRadarrMovie({ id: 7, title: 'Dune', year: 2021 })];
      const unmonitored: number[] = [];

      const mockRadarr = {
        ...radarrSource(movies),
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
          querySources: [{ queryId: 1, role: 'include' as const, sortOrder: 0 }],
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

      const mockMediaQueryService = {
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
          settings: { enabledTasks: ['unmonitorMovie'] },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const executorWithMocks = new AutomationExecutor({
        automationService: mockAutomationService as unknown as AutomationService,
        mediaQueryService: mockMediaQueryService as unknown as MediaQueryService,
        providerSettingsService: mockProviderSettingsService as unknown as ProviderSettingsService,
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

      // Seed media_identity + enrichment for movie 1 only (playCount=3)
      const [identity] = await db
        .insert(mediaIdentity)
        .values({ sourceType: 'RADARR', sourceId: 1 })
        .returning();
      await db.insert(mediaEnrichment).values({
        mediaIdentityId: identity.id,
        playCount: 3,
        enrichedAt: Math.floor(Date.now() / 1000),
      });

      const unmonitored: number[] = [];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;
      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, [{ key: 'watched', value: true }]);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      const enrichedExecutor = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        providerFactory: mockFactory,
        db,
      });

      await enrichedExecutor.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });
  });

  describe('Tier 2 enrichment — lastWatchedDaysAgo filter uses lastWatchedAt from DB', () => {
    it('only executes task on movies whose enrichment row shows lastPlayed >= N days ago', async () => {
      const db = getDb();
      const tenDaysAgoUnix = Math.floor((Date.now() - 10 * 86_400_000) / 1000);

      const movies = [
        createRadarrMovie({ id: 10, title: 'Old Play', hasFile: true }),
        createRadarrMovie({ id: 11, title: 'Recent Play', hasFile: true }),
        createRadarrMovie({ id: 12, title: 'Never Played', hasFile: true }),
      ];

      const [id10] = await db
        .insert(mediaIdentity)
        .values({ sourceType: 'RADARR', sourceId: 10 })
        .returning();
      await db.insert(mediaEnrichment).values({
        mediaIdentityId: id10.id,
        lastWatchedAt: new Date(tenDaysAgoUnix * 1000).toISOString(),
        enrichedAt: Math.floor(Date.now() / 1000),
      });

      const twoDaysAgoUnix = Math.floor((Date.now() - 2 * 86_400_000) / 1000);
      const [id11] = await db
        .insert(mediaIdentity)
        .values({ sourceType: 'RADARR', sourceId: 11 })
        .returning();
      await db.insert(mediaEnrichment).values({
        mediaIdentityId: id11.id,
        lastWatchedAt: new Date(twoDaysAgoUnix * 1000).toISOString(),
        enrichedAt: Math.floor(Date.now() / 1000),
      });

      const unmonitored: number[] = [];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;
      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, [
        { key: 'lastWatchedDaysAgo', value: { min: 7 } },
      ]);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      const enrichedExecutor = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        providerFactory: mockFactory,
        db,
      });

      await enrichedExecutor.execute(automation.id);

      expect(unmonitored).toEqual([10]);
    });
  });

  // ─── Tier 2 enrichment — shows ───────────────────────────────────────────

  describe('Tier 2 enrichment — watched filter on shows uses enrichment DB (mergeShowEnrichment)', () => {
    it('only executes task on shows whose enrichment row shows playCount > 0', async () => {
      const db = getDb();

      const seriesList = [
        createSonarrSeries({ id: 1, title: 'Watched Show', status: 'ended' }),
        createSonarrSeries({ id: 2, title: 'Unwatched Show', status: 'ended' }),
      ];

      // Seed media_identity + enrichment for series 1 only (playCount=5)
      const [identity] = await db
        .insert(mediaIdentity)
        .values({ sourceType: 'SONARR', sourceId: 1 })
        .returning();
      await db.insert(mediaEnrichment).values({
        mediaIdentityId: identity.id,
        playCount: 5,
        enrichedAt: Math.floor(Date.now() / 1000),
      });

      const unmonitored: number[] = [];
      const mockSonarr = {
        ...sonarrSource(seriesList),
        unmonitorSeries: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerSeriesSearch: async () => {},
      } as unknown as SonarrProvider;
      const mockFactory: IProviderFactory = { create: () => mockSonarr };

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedMediaQuery(
        mediaQueryService,
        [{ key: 'watched', value: true }],
        'show'
      );
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorSeries',
      });

      const enrichedExecutor = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        providerFactory: mockFactory,
        db,
      });

      await enrichedExecutor.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });
  });

  // ─── Combination model ───────────────────────────────────────────────────

  describe('CombinationModel — multiple include sources', () => {
    it('executes task only on items surviving include-minus-exclude (difference semantics)', async () => {
      // Movie 1: hasFile:true,  qualityProfileId:10 → include set only → survives
      // Movie 2: hasFile:false, qualityProfileId:10 → neither set
      // Movie 3: hasFile:true,  qualityProfileId:20 → in include AND exclude → excluded
      // Expected: task fires only on movie 1
      const movies = [
        createRadarrMovie({ id: 1, title: 'Keep', hasFile: true, qualityProfileId: 10 }),
        createRadarrMovie({ id: 2, title: 'Skip', hasFile: false, qualityProfileId: 10 }),
        createRadarrMovie({ id: 3, title: 'Remove', hasFile: true, qualityProfileId: 20 }),
      ];

      const unmonitored: number[] = [];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;
      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const provider = await seedRadarrProvider(providerSettingsService);
      // include: all hasFile:true movies → [1, 3]
      const includeQuery = await seedMediaQuery(mediaQueryService, [
        { key: 'hasFile', value: true },
      ]);
      // exclude: qualityProfileId 20 → [3]
      const excludeQuery = await seedMediaQuery(mediaQueryService, [
        { key: 'qualityProfileIds', value: '20' },
      ]);

      const automation = await automationService.create({
        name: 'Difference Test',
        querySources: [
          { queryId: includeQuery.id, role: 'include' },
          { queryId: excludeQuery.id, role: 'exclude' },
        ],
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });

      const executorWithFactory = new AutomationExecutor({
        automationService,
        providerSettingsService,
        mediaQueryService,
        providerFactory: mockFactory,
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await executorWithFactory.execute(automation.id);

      expect(unmonitored).toEqual([1]);
    });

    it('executes task on the union of two non-overlapping include source results', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'A', hasFile: true }),
        createRadarrMovie({ id: 2, title: 'B', hasFile: false }),
        createRadarrMovie({ id: 3, title: 'C', hasFile: true }),
      ];

      const unmonitored: number[] = [];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;
      const mockFactory: IProviderFactory = { create: () => mockRadarr };

      const provider = await seedRadarrProvider(providerSettingsService);
      // Query A: only hasFile:true → movies 1 and 3
      const queryA = await seedMediaQuery(mediaQueryService, [{ key: 'hasFile', value: true }]);
      // Query B: only hasFile:false → movie 2
      const queryB = await seedMediaQuery(mediaQueryService, [{ key: 'hasFile', value: false }]);

      const automation = await automationService.create({
        name: 'Multi-include',
        querySources: [
          { queryId: queryA.id, role: 'include' },
          { queryId: queryB.id, role: 'include' },
        ],
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });

      const executorWithFactory = new AutomationExecutor({
        automationService,
        providerSettingsService,
        mediaQueryService,
        providerFactory: mockFactory,
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await executorWithFactory.execute(automation.id);

      expect(new Set(unmonitored)).toEqual(new Set([1, 2, 3]));
    });
  });

  // ─── Provider creation hoist ─────────────────────────────────────────────

  describe('provider creation hoist', () => {
    it('calls factory.create() exactly once even with two include sources', async () => {
      const movies = [
        createRadarrMovie({ id: 1, title: 'A', hasFile: true }),
        createRadarrMovie({ id: 2, title: 'B', hasFile: false }),
      ];
      const unmonitored: number[] = [];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async (ids: number[]) => {
          unmonitored.push(...ids);
        },
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;

      const createSpy = vi.fn().mockReturnValue(mockRadarr);
      const mockFactory: IProviderFactory = { create: createSpy };

      const provider = await seedRadarrProvider(providerSettingsService);
      const queryA = await seedMediaQuery(mediaQueryService, [{ key: 'hasFile', value: true }]);
      const queryB = await seedMediaQuery(mediaQueryService, [{ key: 'hasFile', value: false }]);

      const automation = await automationService.create({
        name: 'Hoist Test',
        querySources: [
          { queryId: queryA.id, role: 'include' },
          { queryId: queryB.id, role: 'include' },
        ],
        providerId: provider.id,
        taskId: 'unmonitorMovie',
        schedule: '0 * * * *',
      });

      const hoistExecutor = new AutomationExecutor({
        automationService,
        providerSettingsService,
        mediaQueryService,
        providerFactory: mockFactory,
        automationRunService: { createRun: vi.fn() } as unknown as AutomationRunService,
      });

      await hoistExecutor.execute(automation.id);

      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Domain events: run:started ──────────────────────────────────────────

  describe('domain events — run:started', () => {
    it('emits run:started with automation metadata before the run body runs', async () => {
      const db = getDb();
      const bus = new DomainEventBus();
      const started: DomainEvents['run:started'][] = [];
      bus.on('run:started', (p) => started.push(p));

      let firedBeforeBody = false;
      const run = vi.fn(async () => {
        firedBeforeBody = started.length === 1;
        return 0;
      });

      const ex = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: { run },
        eventBus: bus,
      });
      const id = await seedSystemTask('system:enrichment');

      await ex.execute(id);

      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({
        automationId: id,
        kind: 'system',
        taskId: 'system:enrichment',
      });
      expect(started[0].startedAt).toBeInstanceOf(Date);
      expect(firedBeforeBody).toBe(true);
    });
  });

  // ─── Domain events: run:completed (success) ──────────────────────────────

  describe('domain events — run:completed', () => {
    it('emits run:completed post-commit carrying the persisted run id and ranAt', async () => {
      const db = getDb();
      const bus = new DomainEventBus();
      const completed: DomainEvents['run:completed'][] = [];
      bus.on('run:completed', (p) => completed.push(p));

      const ex = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: { run: vi.fn(async () => 3) },
        eventBus: bus,
      });
      const id = await seedSystemTask('system:enrichment');

      await ex.execute(id);

      expect(completed).toHaveLength(1);
      const [row] = await db.select().from(automationRuns);
      expect(completed[0].runId).toBe(row.id);
      expect(completed[0].ranAt.getTime()).toBe(row.ranAt.getTime());
      expect(completed[0]).toMatchObject({
        automationId: id,
        kind: 'system',
        status: 'success',
        itemCount: 3,
      });
      expect(completed[0].finishedAt).toBeInstanceOf(Date);
    });
  });

  // ─── Domain events: run:completed (failure) ──────────────────────────────

  describe('domain events — run:completed on failure', () => {
    it('still emits run:completed with status error and the message when the run throws', async () => {
      const db = getDb();
      const bus = new DomainEventBus();
      const completed: DomainEvents['run:completed'][] = [];
      bus.on('run:completed', (p) => completed.push(p));

      const ex = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: {
          run: vi.fn(async () => {
            throw new Error('runner boom');
          }),
        },
        eventBus: bus,
      });
      const id = await seedSystemTask('system:enrichment');

      await ex.execute(id);

      expect(completed).toHaveLength(1);
      expect(completed[0]).toMatchObject({
        automationId: id,
        status: 'error',
        error: 'runner boom',
      });
      const [row] = await db.select().from(automationRuns);
      expect(completed[0].runId).toBe(row.id);
    });
  });

  // ─── Domain events: <scope>:changed gate ─────────────────────────────────

  describe('domain events — media:changed gate', () => {
    function makeExecutor(bus: DomainEventBus, provider: RadarrProvider) {
      return new AutomationExecutor({
        automationService,
        providerSettingsService,
        mediaQueryService,
        providerFactory: { create: () => provider },
        automationRunService: new AutomationRunService({ db: getDb() }),
        eventBus: bus,
      });
    }

    it('emits media:changed for a media-scoped task that changed at least one item', async () => {
      const bus = new DomainEventBus();
      const changes: DomainEvents['media:changed'][] = [];
      bus.on('media:changed', (p) => changes.push(p));

      const movies = [createRadarrMovie({ id: 1, title: 'A', hasFile: true })];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async () => {},
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await makeExecutor(bus, mockRadarr).execute(automation.id);

      expect(changes).toHaveLength(1);
    });

    it('does not emit media:changed when a scoped task changed zero items', async () => {
      const bus = new DomainEventBus();
      const changes: DomainEvents['media:changed'][] = [];
      bus.on('media:changed', (p) => changes.push(p));

      const mockRadarr = {
        ...radarrSource([]),
        unmonitorMovies: async () => {},
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await makeExecutor(bus, mockRadarr).execute(automation.id);

      expect(changes).toHaveLength(0);
    });

    it('does not emit media:changed for an unscoped task even when items match', async () => {
      const bus = new DomainEventBus();
      const changes: DomainEvents['media:changed'][] = [];
      bus.on('media:changed', (p) => changes.push(p));

      const movies = [createRadarrMovie({ id: 1, title: 'A', hasFile: false })];
      const mockRadarr = {
        ...radarrSource(movies),
        unmonitorMovies: async () => {},
        triggerMoviesSearch: async () => {},
      } as unknown as RadarrProvider;

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedMediaQuery(mediaQueryService, []);
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'triggerSearch',
      });

      await makeExecutor(bus, mockRadarr).execute(automation.id);

      expect(changes).toHaveLength(0);
    });

    it('emits media:changed for a system data job that changed items', async () => {
      const db = getDb();
      const bus = new DomainEventBus();
      const changes: DomainEvents['media:changed'][] = [];
      bus.on('media:changed', (p) => changes.push(p));

      const ex = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: { run: vi.fn(async () => 4) },
        eventBus: bus,
      });
      const id = await seedSystemTask('system:enrichment');

      await ex.execute(id);

      expect(changes).toHaveLength(1);
    });

    it('does not emit media:changed for a system data job that changed zero items', async () => {
      const db = getDb();
      const bus = new DomainEventBus();
      const changes: DomainEvents['media:changed'][] = [];
      bus.on('media:changed', (p) => changes.push(p));

      const ex = new AutomationExecutor({
        automationService,
        automationRunService: new AutomationRunService({ db }),
        providerSettingsService,
        mediaQueryService,
        systemTaskRunner: { run: vi.fn(async () => 0) },
        eventBus: bus,
      });
      const id = await seedSystemTask('system:identity-resolution');

      await ex.execute(id);

      expect(changes).toHaveLength(0);
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

describe('dispatch scope declaration', () => {
  it('declares media scope on unmonitor tasks and none on triggerSearch', () => {
    const cfg = { name: 'x', url: 'http://localhost/api/v3', apiKey: 'k', settings: null };
    const radarr = new RadarrProvider(cfg, getChildLogger('scope-test')).tasks();
    const sonarr = new SonarrProvider(cfg, getChildLogger('scope-test')).tasks();
    expect(radarr.find((t) => t.id === 'unmonitorMovie')?.affects).toBe('media');
    expect(radarr.find((t) => t.id === 'triggerSearch')?.affects).toBeUndefined();
    expect(sonarr.find((t) => t.id === 'unmonitorSeries')?.affects).toBe('media');
    expect(sonarr.find((t) => t.id === 'triggerSearch')?.affects).toBeUndefined();
  });
});
