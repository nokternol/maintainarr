import { getChildLogger } from '@server/logger';
import type { ProviderConfig } from '@server/providers/baseMetadataProvider';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../../tests/mocks/server';

const logger = getChildLogger('TestSonarrProvider');

const SONARR_BASE = 'http://localhost:8989/api/v3';

const mockConfig: ProviderConfig = {
  name: 'Test Sonarr',
  url: SONARR_BASE,
  apiKey: 'fake-api-key',
  settings: {},
};

afterEach(() => server.resetHandlers());

describe('SonarrProvider — MediaSource read role', () => {
  const provider = new SonarrProvider(mockConfig, logger);

  it('serves normalized media items whose ids project back via idOf', async () => {
    const items = await provider.getMediaItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Breaking Bad');
    expect(provider.idOf(items[0])).toBe(1);
    expect(provider.enrichmentSourceType).toBe('SONARR');
  });
});

describe('SonarrProvider', () => {
  const provider = new SonarrProvider(mockConfig, logger);

  it('fetches and parses series correctly', async () => {
    const series = await provider.getSeries();
    expect(series).toHaveLength(1);
    expect(series[0].title).toBe('Breaking Bad');
    expect(series[0].tvdbId).toBe(81189);
  });

  it('fetches and parses quality profiles correctly', async () => {
    const profiles = await provider.getProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe('HD-1080p');
  });

  it('fetches and parses root folders correctly', async () => {
    const folders = await provider.getRootFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].path).toBe('/tv');
  });

  it('fetches and parses tags correctly', async () => {
    const tags = await provider.getTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].label).toBe('drama');
  });
});

describe('SonarrProvider — task methods', () => {
  const provider = new SonarrProvider(mockConfig, logger);

  it('triggerSeriesSearch posts one SeriesSearch command per series ID', async () => {
    const commandBodies: unknown[] = [];
    server.use(
      http.post(`${SONARR_BASE}/command`, async ({ request }) => {
        commandBodies.push(await request.json());
        return HttpResponse.json({ id: 99 });
      })
    );

    await provider.triggerSeriesSearch([1, 2]);

    expect(commandBodies).toHaveLength(2);
    expect(commandBodies).toEqual(
      expect.arrayContaining([
        { name: 'SeriesSearch', seriesId: 1 },
        { name: 'SeriesSearch', seriesId: 2 },
      ])
    );
  });

  it('unmonitorSeries sends PUT /series/{id} with monitored:false for each ID', async () => {
    const putBodies: Array<{ id: number; monitored: boolean }> = [];
    server.use(
      http.get(`${SONARR_BASE}/series`, () =>
        HttpResponse.json([
          {
            id: 1,
            title: 'Show A',
            monitored: true,
            status: 'ended',
            tvdbId: 1,
            profileId: 1,
            qualityProfileId: 1,
            languageProfileId: 1,
            tags: [],
            path: '/tv/A',
            seasons: [],
          },
          {
            id: 2,
            title: 'Show B',
            monitored: true,
            status: 'ended',
            tvdbId: 2,
            profileId: 1,
            qualityProfileId: 1,
            languageProfileId: 1,
            tags: [],
            path: '/tv/B',
            seasons: [],
          },
        ])
      ),
      http.put(`${SONARR_BASE}/series/:id`, async ({ params, request }) => {
        const body = (await request.json()) as { monitored: boolean };
        putBodies.push({ id: Number(params.id), monitored: body.monitored });
        return HttpResponse.json({ id: Number(params.id) });
      })
    );

    await provider.unmonitorSeries([1, 2]);

    expect(putBodies).toHaveLength(2);
    expect(putBodies.every((b) => b.monitored === false)).toBe(true);
    expect(putBodies.map((b) => b.id)).toEqual(expect.arrayContaining([1, 2]));
  });
});
