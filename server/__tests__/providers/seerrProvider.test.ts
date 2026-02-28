import {
  type MetadataProvider,
  MetadataProviderType,
} from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { SeerrProvider } from '@server/providers/seerrProvider';
import { describe, expect, it } from 'vitest';

const logger = getChildLogger('TestSeerrProvider');

const mockEntity: MetadataProvider = {
  id: 6,
  type: MetadataProviderType.SEERR,
  name: 'Test Seerr',
  url: 'http://localhost:5056',
  apiKey: 'fake-api-key',
  settings: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SeerrProvider', () => {
  const provider = new SeerrProvider(mockEntity, logger);

  it('fetches and parses requests correctly (same API as Overseerr)', async () => {
    const requests = await provider.getRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].type).toBe('movie');
    expect(requests[0].media.tmdbId).toBe(603);
  });
});
