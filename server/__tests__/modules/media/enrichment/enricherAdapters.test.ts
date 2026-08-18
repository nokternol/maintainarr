import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/kernel/logger';
import {
  overseerrEnricher,
  plexEnricher,
  tautulliEnricher,
  tmdbEnricher,
} from '@server/modules/media/enrichment/enricherAdapters';
import type { NormalizedMovie } from '@server/modules/media/movie';
import type { ProviderConfig } from '@server/modules/providers/connections/baseProviderConnection';
import { OverseerrProvider } from '@server/modules/providers/connections/overseerrProvider';
import { PlexProvider } from '@server/modules/providers/connections/plexProvider';
import { TautulliProvider } from '@server/modules/providers/connections/tautulliProvider';
import { TmdbProvider } from '@server/modules/providers/connections/tmdbProvider';
import { describe, expect, it, vi } from 'vitest';

const mockLogger = getChildLogger('TestEnricherAdapters');

const mockConfig: ProviderConfig = {
  name: 'Test Plex',
  url: 'http://localhost:32400',
  apiKey: 'fake-plex-token',
  settings: {},
};

describe('plexEnricher', () => {
  it('decorates a matched item with its play count, tagged by provider', async () => {
    const plex = new PlexProvider(mockConfig, mockLogger);
    vi.spyOn(plex, 'getAllItems').mockResolvedValue([
      { ratingKey: 'plex-1', title: 'The Matrix', type: 'movie', viewCount: 2 },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

    const result = await plexEnricher(plex).enrich([item]);

    expect(result.provider).toBe(MetadataProviderType.PLEX);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].playCount).toBe(2);
    expect(result.items[0].plexAddedAt).toBeUndefined();
  });

  it('omits and does not mutate an item whose key it does not speak', async () => {
    const plex = new PlexProvider(mockConfig, mockLogger);
    vi.spyOn(plex, 'getAllItems').mockResolvedValue([
      { ratingKey: 'plex-1', title: 'The Matrix', type: 'movie', viewCount: 2 },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-999' }, title: 'Unknown' };

    const result = await plexEnricher(plex).enrich([item]);

    expect(result.items).toHaveLength(0);
    expect(item.playCount).toBeUndefined();
  });

  it('decorates a matched item with its ISO last-viewed timestamp', async () => {
    const plex = new PlexProvider(mockConfig, mockLogger);
    vi.spyOn(plex, 'getAllItems').mockResolvedValue([
      {
        ratingKey: 'plex-1',
        title: 'The Matrix',
        type: 'movie',
        viewCount: 2,
        lastViewedAt: 1700000000,
      },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

    const result = await plexEnricher(plex).enrich([item]);

    expect(result.items[0].lastWatchedAt).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it('decorates a matched item with its ISO added-to-Plex timestamp', async () => {
    const plex = new PlexProvider(mockConfig, mockLogger);
    vi.spyOn(plex, 'getAllItems').mockResolvedValue([
      {
        ratingKey: 'plex-1',
        title: 'The Matrix',
        type: 'movie',
        addedAt: 1700000000,
      },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

    const result = await plexEnricher(plex).enrich([item]);

    expect(result.items[0].plexAddedAt).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it('decorates a matched item with its studio', async () => {
    const plex = new PlexProvider(mockConfig, mockLogger);
    vi.spyOn(plex, 'getAllItems').mockResolvedValue([
      { ratingKey: 'plex-1', title: 'The Matrix', type: 'movie', studio: 'Warner Bros' },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

    const result = await plexEnricher(plex).enrich([item]);

    expect(result.items[0].studio).toBe('Warner Bros');
  });

  it('decorates a matched item with its runtime in minutes, converted from milliseconds', async () => {
    const plex = new PlexProvider(mockConfig, mockLogger);
    vi.spyOn(plex, 'getAllItems').mockResolvedValue([
      { ratingKey: 'plex-1', title: 'The Matrix', type: 'movie', duration: 8_160_000 },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

    const result = await plexEnricher(plex).enrich([item]);

    expect(result.items[0].runtimeMinutes).toBe(136);
  });
});

describe('tautulliEnricher', () => {
  it('decorates a matched item with its play count, tagged by provider', async () => {
    const tautulli = new TautulliProvider(mockConfig, mockLogger);
    vi.spyOn(tautulli, 'getHistory').mockResolvedValue([
      {
        rating_key: 'plex-1',
        title: 'The Matrix',
        user: 'u',
        watched_status: 1,
        duration: 1,
        play_duration: 1,
      },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

    const result = await tautulliEnricher(tautulli).enrich([item]);

    expect(result.provider).toBe(MetadataProviderType.TAUTULLI);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].playCount).toBe(1);
  });

  it('decorates a matched item with its ISO last-watched timestamp', async () => {
    const tautulli = new TautulliProvider(mockConfig, mockLogger);
    vi.spyOn(tautulli, 'getHistory').mockResolvedValue([
      {
        rating_key: 'plex-1',
        title: 'The Matrix',
        user: 'u',
        watched_status: 1,
        duration: 1,
        play_duration: 1,
        played_at: 1700000000,
      },
    ]);
    const item: NormalizedMovie = { _sourceIds: { plex: 'plex-1' }, title: 'The Matrix' };

    const result = await tautulliEnricher(tautulli).enrich([item]);

    expect(result.items[0].lastWatchedAt).toBe(new Date(1700000000 * 1000).toISOString());
  });
});

describe('overseerrEnricher', () => {
  it('decorates a matched item with request status and issue flag, tagged by provider', async () => {
    const overseerr = new OverseerrProvider(mockConfig, mockLogger);
    vi.spyOn(overseerr, 'getRequests').mockResolvedValue([
      {
        id: 1,
        status: 2,
        type: 'movie',
        requestedBy: { id: 1, displayName: 'u', email: 'u@u.com' },
        media: { tmdbId: 100, title: 'M' },
        createdAt: '',
      },
    ]);
    vi.spyOn(overseerr, 'getIssues').mockResolvedValue([
      { id: 1, status: 1, media: { tmdbId: 100 } },
    ]);
    const item: NormalizedMovie = { _sourceIds: { tmdb: 100 }, title: 'M' };

    const result = await overseerrEnricher(overseerr).enrich([item]);

    expect(result.provider).toBe(MetadataProviderType.OVERSEERR);
    expect(result.items[0].overseerrRequestStatus).toBe(2);
    expect(result.items[0].overseerrHasIssue).toBe(true);
  });
});

describe('tmdbEnricher', () => {
  it('calls getStatus once per unique tmdbId, even with duplicate ids in the batch', async () => {
    const tmdb = new TmdbProvider(mockConfig, mockLogger);
    const getStatus = vi.spyOn(tmdb, 'getStatus').mockResolvedValue('Released');
    const items: NormalizedMovie[] = [
      { _sourceIds: { tmdb: 100 }, title: 'M1' },
      { _sourceIds: { tmdb: 100 }, title: 'M1 dup' },
    ];

    const result = await tmdbEnricher(tmdb).enrich(items);

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe(MetadataProviderType.TMDB);
    expect(result.items.every((i) => i.tmdbStatus === 'Released')).toBe(true);
  });
});
