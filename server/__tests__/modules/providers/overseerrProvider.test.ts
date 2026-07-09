import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/kernel/logger';
import type { NormalizedMovie } from '@server/modules/media/movie';
import type { ProviderConfig } from '@server/modules/providers/connections/baseProviderConnection';
import { OverseerrProvider } from '@server/modules/providers/connections/overseerrProvider';
import { describe, expect, it, vi } from 'vitest';

const logger = getChildLogger('TestOverseerrProvider');

const mockConfig: ProviderConfig = {
  name: 'Test Overseerr',
  url: 'http://localhost:5055',
  apiKey: 'fake-api-key',
  settings: {},
};

describe('OverseerrProvider', () => {
  const provider = new OverseerrProvider(mockConfig, logger);

  it('fetches and parses requests correctly', async () => {
    const requests = await provider.getRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].type).toBe('movie');
    expect(requests[0].media.tmdbId).toBe(603);
  });

  it('getIssues() returns all issues with id, status and media.tmdbId', async () => {
    const issues = await provider.getIssues();
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ id: 1, status: 1, media: { tmdbId: 603 } });
    expect(issues[1]).toMatchObject({ id: 2, status: 1, media: { tmdbId: 704 } });
  });

  describe('enrich (MediaEnricher)', () => {
    it('decorates a matched item with request status and issue flag, tagged by provider', async () => {
      vi.spyOn(provider, 'getRequests').mockResolvedValue([
        {
          id: 1,
          status: 2,
          type: 'movie',
          requestedBy: { id: 1, displayName: 'u', email: 'u@u.com' },
          media: { tmdbId: 100, title: 'M' },
          createdAt: '',
        },
      ]);
      vi.spyOn(provider, 'getIssues').mockResolvedValue([
        { id: 1, status: 1, media: { tmdbId: 100 } },
      ]);
      const item: NormalizedMovie = { _sourceIds: { tmdb: 100 }, title: 'M' };

      const result = await provider.enrich([item]);

      expect(result.provider).toBe(MetadataProviderType.OVERSEERR);
      expect(result.items[0].overseerrRequestStatus).toBe(2);
      expect(result.items[0].overseerrHasIssue).toBe(true);
    });
  });
});
