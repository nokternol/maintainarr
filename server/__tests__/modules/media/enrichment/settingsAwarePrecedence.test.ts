import { MetadataProviderType } from '@server/database/schema';
import { applyPrimaryMediaServer } from '@server/modules/media/enrichment/settingsAwarePrecedence';
import { describe, expect, it } from 'vitest';

describe('applyPrimaryMediaServer', () => {
  it('puts JELLYFIN first in a Plex/Jellyfin contested order when primaryMediaServer is JELLYFIN', () => {
    const base = {
      plexAddedAt: [MetadataProviderType.PLEX, MetadataProviderType.JELLYFIN] as const,
    };

    const effective = applyPrimaryMediaServer(base, 'JELLYFIN');

    expect(effective.plexAddedAt).toEqual([
      MetadataProviderType.JELLYFIN,
      MetadataProviderType.PLEX,
    ]);
  });

  it('leaves a field with no Plex/Jellyfin pair unchanged regardless of primaryMediaServer', () => {
    const base = {
      playCount: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX] as const,
    };

    const effective = applyPrimaryMediaServer(base, 'JELLYFIN');

    expect(effective.playCount).toEqual([MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX]);
  });
});
