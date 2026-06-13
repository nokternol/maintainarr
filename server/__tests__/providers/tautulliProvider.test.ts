import { getChildLogger } from '@server/logger';
import type { ProviderConfig } from '@server/providers/baseMetadataProvider';
import { TautulliProvider } from '@server/providers/tautulliProvider';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

const logger = getChildLogger('TestTautulliProvider');

const mockConfig: ProviderConfig = {
  name: 'Test Tautulli',
  url: 'http://localhost:8181',
  apiKey: 'fake-api-key',
  settings: {},
};

describe('TautulliProvider', () => {
  const provider = new TautulliProvider(mockConfig, logger);

  it('fetches and parses library stats correctly', async () => {
    const stats = await provider.getLibraryStats();
    expect(stats).toHaveLength(2);
    expect(stats[0].section_name).toBe('Movies');
    expect(stats[0].section_type).toBe('movie');
  });

  it('fetches and parses home stats correctly', async () => {
    const stats = await provider.getHomeStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].stat_id).toBe('top_movies');
    expect(stats[0].rows[0].title).toBe('The Matrix');
  });

  it('fetches and parses watch history correctly', async () => {
    const history = await provider.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe('The Matrix');
    expect(history[0].watched_status).toBe(1);
  });
});
