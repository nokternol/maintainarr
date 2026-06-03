/**
 * AutomationExecutor tests — end-to-end execution of automation tasks.
 *
 * Uses a real in-memory SQLite DB and MSW for HTTP interception.
 * The executor takes all dependencies via constructor — no DI magic.
 *
 * Run: vitest run --project server
 */
import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import { MetadataProviderType } from '@server/database/schema';
import { AutomationExecutor } from '@server/services/automationExecutor';
import { AutomationService } from '@server/services/automationService';
import { ProviderSettingsService } from '@server/services/providerSettingsService';
import { SavedQueryService } from '@server/services/savedQueryService';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

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
  filters: Record<string, unknown> = {}
) {
  return savedQueryService.create({ name: 'Test Query', filters });
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
        {
          id: 1,
          title: 'The Matrix',
          year: 1999,
          hasFile: true,
          monitored: true,
          tmdbId: 603,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/The Matrix',
          path: '/movies/The Matrix',
        },
        {
          id: 2,
          title: 'Interstellar',
          year: 2014,
          hasFile: true,
          monitored: true,
          tmdbId: 157336,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/Interstellar',
          path: '/movies/Interstellar',
        },
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
      const query = await seedSavedQuery(savedQueryService, {});
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
        {
          id: 1,
          title: 'The Matrix',
          year: 1999,
          hasFile: true,
          monitored: true,
          tmdbId: 603,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/The Matrix',
          path: '/movies/The Matrix',
        },
        {
          id: 2,
          title: 'Inception',
          year: 2010,
          hasFile: false,
          monitored: true,
          tmdbId: 27205,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/Inception',
          path: '/movies/Inception',
        },
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
      // Filter: only movies that have a file
      const query = await seedSavedQuery(savedQueryService, { hasFile: 'true' });
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'unmonitorMovie',
      });

      await executor.execute(automation.id);

      // Only movie id=1 has hasFile:true
      expect(unmonitored).toEqual([1]);
    });

    it('records a successful run with the item count', async () => {
      const movies = [
        {
          id: 1,
          title: 'The Matrix',
          year: 1999,
          hasFile: true,
          monitored: true,
          tmdbId: 603,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/The Matrix',
          path: '/movies/The Matrix',
        },
      ];

      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
        http.put(`${RADARR_URL}/api/v3/movie/:id`, () =>
          HttpResponse.json({ id: 1, monitored: false })
        )
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, {});
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
      const query = await seedSavedQuery(savedQueryService, {});
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
        {
          id: 1,
          title: 'The Matrix',
          year: 1999,
          hasFile: false,
          monitored: true,
          tmdbId: 603,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/The Matrix',
          path: '/movies/The Matrix',
        },
        {
          id: 2,
          title: 'Interstellar',
          year: 2014,
          hasFile: false,
          monitored: true,
          tmdbId: 157336,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/Interstellar',
          path: '/movies/Interstellar',
        },
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
      const query = await seedSavedQuery(savedQueryService, {});
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'triggerSearch',
      });

      await executor.execute(automation.id);

      expect(commandBody).toEqual({ name: 'MoviesSearch', movieIds: [1, 2] });
    });

    it('records success with the matched item count', async () => {
      const movies = [
        {
          id: 3,
          title: 'Dune',
          year: 2021,
          hasFile: false,
          monitored: true,
          tmdbId: 438631,
          profileId: 1,
          qualityProfileId: 1,
          tags: [],
          folderName: '/movies/Dune',
          path: '/movies/Dune',
        },
      ];

      server.use(
        http.get(`${RADARR_URL}/api/v3/movie`, () => HttpResponse.json(movies)),
        http.post(`${RADARR_URL}/api/v3/command`, () => HttpResponse.json({ id: 1 }))
      );

      const provider = await seedRadarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, {});
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
        {
          id: 1,
          title: 'Breaking Bad',
          year: 2008,
          status: 'ended',
          monitored: true,
          tvdbId: 81189,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/Breaking Bad',
          seasons: [],
        },
        {
          id: 2,
          title: 'The Wire',
          year: 2002,
          status: 'ended',
          monitored: true,
          tvdbId: 79126,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/The Wire',
          seasons: [],
        },
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
      const query = await seedSavedQuery(savedQueryService, {});
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
        {
          id: 1,
          title: 'Breaking Bad',
          year: 2008,
          status: 'ended',
          monitored: true,
          tvdbId: 81189,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/Breaking Bad',
          seasons: [],
        },
        {
          id: 2,
          title: 'Ongoing Show',
          year: 2020,
          status: 'continuing',
          monitored: true,
          tvdbId: 99999,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/Ongoing Show',
          seasons: [],
        },
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
      // Filter: only ended series
      const query = await seedSavedQuery(savedQueryService, { seriesStatus: 'ended' });
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
        {
          id: 1,
          title: 'Breaking Bad',
          year: 2008,
          status: 'ended',
          monitored: true,
          tvdbId: 81189,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/Breaking Bad',
          seasons: [],
        },
      ];

      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.put(`${SONARR_URL}/api/v3/series/:id`, () =>
          HttpResponse.json({ id: 1, monitored: false })
        )
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, {});
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
        {
          id: 1,
          title: 'Breaking Bad',
          year: 2008,
          status: 'ended',
          monitored: true,
          tvdbId: 81189,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/Breaking Bad',
          seasons: [],
        },
        {
          id: 2,
          title: 'The Wire',
          year: 2002,
          status: 'ended',
          monitored: true,
          tvdbId: 79126,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/The Wire',
          seasons: [],
        },
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
      const query = await seedSavedQuery(savedQueryService, {});
      const automation = await seedAutomation(automationService, {
        queryId: query.id,
        providerId: provider.id,
        taskId: 'triggerSearch',
      });

      await executor.execute(automation.id);

      // One command per series
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
        {
          id: 5,
          title: 'Severance',
          year: 2022,
          status: 'continuing',
          monitored: true,
          tvdbId: 371980,
          profileId: 1,
          qualityProfileId: 1,
          languageProfileId: 1,
          tags: [],
          path: '/tv/Severance',
          seasons: [],
        },
      ];

      server.use(
        http.get(`${SONARR_URL}/api/v3/series`, () => HttpResponse.json(seriesList)),
        http.post(`${SONARR_URL}/api/v3/command`, () => HttpResponse.json({ id: 1 }))
      );

      const provider = await seedSonarrProvider(providerSettingsService);
      const query = await seedSavedQuery(savedQueryService, {});
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
      const query = await seedSavedQuery(savedQueryService, {});
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

  // ─── Scheduler wiring ────────────────────────────────────────────────────

  describe('AutomationScheduler integration', () => {
    it('calls executor.execute when a scheduled tick fires', async () => {
      // This test verifies the scheduler wiring is correct.
      // We import AutomationScheduler and pass it a mock executor,
      // then fire a tick manually via the Cron job (using a past cron expression
      // that fires immediately). We check the executor was called with the automation ID.
      const { AutomationScheduler } = await import('@server/cron/automationScheduler');

      let executedId: number | null = null;
      const mockExecutor = {
        execute: async (id: number) => {
          executedId = id;
        },
      };

      const scheduler = new AutomationScheduler(mockExecutor);

      // Schedule with a past trigger date to fire immediately.
      // We use a very short cron interval and advance past it manually
      // by invoking the job trigger directly.
      scheduler.schedule({ id: 42, name: 'Test', schedule: '* * * * * *' });

      // Wait one tick (croner fires synchronously on the second)
      await new Promise((resolve) => setTimeout(resolve, 1100));
      scheduler.stopAll();

      expect(executedId).toBe(42);
    });
  });
});
