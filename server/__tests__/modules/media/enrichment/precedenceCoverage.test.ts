import { MetadataProviderType } from '@server/database/schema';
import { assertContestedFieldsCovered } from '@server/modules/media/enrichment/precedence';
import { describe, expect, it } from 'vitest';

describe('assertContestedFieldsCovered', () => {
  it('throws when an active field producer is missing from its contested field precedence order', () => {
    const fieldsByType = {
      [MetadataProviderType.TAUTULLI]: ['playCount'] as const,
      [MetadataProviderType.PLEX]: ['playCount'] as const,
    };
    const precedence = {
      playCount: [MetadataProviderType.TAUTULLI] as const,
    };

    expect(() =>
      assertContestedFieldsCovered(
        new Set([MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX]),
        precedence,
        fieldsByType
      )
    ).toThrow(/playCount/);
  });

  it('does not throw when every active producer of a contested field is covered', () => {
    const fieldsByType = {
      [MetadataProviderType.TAUTULLI]: ['playCount'] as const,
      [MetadataProviderType.PLEX]: ['playCount'] as const,
    };
    const precedence = {
      playCount: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX] as const,
    };

    expect(() =>
      assertContestedFieldsCovered(
        new Set([MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX]),
        precedence,
        fieldsByType
      )
    ).not.toThrow();
  });
});
