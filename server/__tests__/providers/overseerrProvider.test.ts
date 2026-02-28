import { type MetadataProvider, MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { OverseerrProvider } from '@server/providers/overseerrProvider';
import { describe, expect, it } from 'vitest';

const logger = getChildLogger('TestOverseerrProvider');

const mockEntity: MetadataProvider = {
  id: 5,
  type: MetadataProviderType.OVERSEERR,
  name: 'Test Overseerr',
  url: 'http://localhost:5055',
  apiKey: 'fake-api-key',
  settings: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('OverseerrProvider', () => {
  const provider = new OverseerrProvider(mockEntity, logger);

  it('fetches and parses requests correctly', async () => {
    const requests = await provider.getRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].type).toBe('movie');
    expect(requests[0].media.tmdbId).toBe(603);
  });
});
