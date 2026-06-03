import { getChildLogger } from '@server/logger';
import type { ProviderConfig } from '@server/providers/baseMetadataProvider';
import { RadarrProvider } from '@server/providers/radarrProvider';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../../tests/mocks/server';

const mockLogger = getChildLogger('TestRadarrProvider');

const RADARR_BASE = 'http://localhost:7878/api/v3';

const mockConfig: ProviderConfig = {
  name: 'Test Radarr',
  url: RADARR_BASE,
  apiKey: 'fake-api-key',
  settings: {},
};

afterEach(() => server.resetHandlers());

describe('RadarrProvider', () => {
  const provider = new RadarrProvider(mockConfig, mockLogger);

  it('fetches and parses movies correctly', async () => {
    const movies = await provider.getMovies();
    expect(movies).toHaveLength(1);
    expect(movies[0].title).toBe('The Matrix');
    expect(movies[0].tmdbId).toBe(603);
  });

  it('fetches and parses quality profiles correctly', async () => {
    const profiles = await provider.getProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe('HD-1080p');
  });

  it('fetches and parses root folders correctly', async () => {
    const folders = await provider.getRootFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].path).toBe('/movies');
  });

  it('fetches and parses tags correctly', async () => {
    const tags = await provider.getTags();
    expect(tags).toHaveLength(2);
    expect(tags[0].label).toBe('action');
  });
});

describe('RadarrProvider — task methods', () => {
  const provider = new RadarrProvider(mockConfig, mockLogger);

  it('triggerMoviesSearch posts MoviesSearch command with given IDs', async () => {
    let commandBody: unknown = null;
    server.use(
      http.post(`${RADARR_BASE}/command`, async ({ request }) => {
        commandBody = await request.json();
        return HttpResponse.json({ id: 99 });
      })
    );

    await provider.triggerMoviesSearch([1, 2, 3]);

    expect(commandBody).toEqual({ name: 'MoviesSearch', movieIds: [1, 2, 3] });
  });

  it('unmonitorMovies sends PUT /movie/{id} with monitored:false for each ID', async () => {
    const putBodies: Array<{ id: number; monitored: boolean }> = [];
    server.use(
      http.get(`${RADARR_BASE}/movie`, () =>
        HttpResponse.json([
          { id: 1, title: 'Movie A', monitored: true, hasFile: true, tags: [], qualityProfileId: 1, profileId: 1, tmdbId: 1, folderName: '', path: '' },
          { id: 2, title: 'Movie B', monitored: true, hasFile: true, tags: [], qualityProfileId: 1, profileId: 1, tmdbId: 2, folderName: '', path: '' },
        ])
      ),
      http.put(`${RADARR_BASE}/movie/:id`, async ({ params, request }) => {
        const body = (await request.json()) as { monitored: boolean };
        putBodies.push({ id: Number(params.id), monitored: body.monitored });
        return HttpResponse.json({ id: Number(params.id) });
      })
    );

    await provider.unmonitorMovies([1, 2]);

    expect(putBodies).toHaveLength(2);
    expect(putBodies.every((b) => b.monitored === false)).toBe(true);
    expect(putBodies.map((b) => b.id)).toEqual(expect.arrayContaining([1, 2]));
  });
});
