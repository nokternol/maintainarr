import { type MetadataProvider, MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/kernel/logger';
import { BaseProviderConnection } from '@server/providers/baseProviderConnection';
import { describe, expect, it } from 'vitest';

const mockLogger = getChildLogger('TestBaseProviderConnection');

class TestProvider extends BaseProviderConnection {}

const mockEntity: MetadataProvider = {
  id: 1,
  type: MetadataProviderType.RADARR,
  name: 'Test Radarr',
  url: 'http://localhost:7878',
  apiKey: 'my-secret-key',
  settings: { useSsl: false },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BaseProviderConnection', () => {
  it('can be instantiated with a MetadataProvider entity', () => {
    const provider = new TestProvider(mockEntity, mockLogger);
    expect(provider).toBeDefined();
  });

  it('can be instantiated with a urlBase setting', () => {
    const provider = new TestProvider(
      { ...mockEntity, settings: { urlBase: '/radarr' } },
      mockLogger
    );
    expect(provider).toBeDefined();
  });
});
