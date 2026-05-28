import { getChildLogger } from '@server/logger';
import type { ProviderConfig } from '@server/providers/baseMetadataProvider';
import { OverseerrProvider } from '@server/providers/overseerrProvider';
import { describe, expect, it } from 'vitest';

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
});
