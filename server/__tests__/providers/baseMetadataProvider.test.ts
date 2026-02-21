import {
  type MetadataProvider,
  MetadataProviderType,
} from '@server/database/entities/MetadataProvider';
import { getChildLogger } from '@server/logger';
import { BaseMetadataProvider } from '@server/providers/baseMetadataProvider';
import { describe, expect, it } from 'vitest';

const mockLogger = getChildLogger('TestBaseMetadataProvider');

class TestProvider extends BaseMetadataProvider {}

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

describe('BaseMetadataProvider', () => {
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
