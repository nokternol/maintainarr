import { MetadataProviderType } from '@server/database/schema';
import type { EnrichmentResult } from '@server/modules/media/enrichment/enricher';
import { resolvePrecedence } from '@server/modules/media/enrichment/precedence';
import type { NormalizedMovie } from '@server/modules/media/movie';
import { describe, expect, it } from 'vitest';

function result(provider: MetadataProviderType, item: NormalizedMovie): EnrichmentResult {
  return { provider, items: [item] };
}

describe('resolvePrecedence', () => {
  it('resolves a contested field to the provider first in contestedFieldPrecedence', () => {
    const tautulli = result(MetadataProviderType.TAUTULLI, {
      _sourceIds: { radarr: 1 },
      title: 'M',
      playCount: 5,
    });
    const plex = result(MetadataProviderType.PLEX, {
      _sourceIds: { radarr: 1 },
      title: 'M',
      playCount: 2,
    });

    const resolved = resolvePrecedence([plex, tautulli], {
      playCount: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX] as const,
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].playCount).toBe(5);
  });

  it('passes through a field with no contestedFieldPrecedence entry from its sole contributor', () => {
    const tmdb = result(MetadataProviderType.TMDB, {
      _sourceIds: { radarr: 1 },
      title: 'M',
      tmdbStatus: 'Released',
    });

    const resolved = resolvePrecedence([tmdb], {});

    expect(resolved[0].tmdbStatus).toBe('Released');
  });

  it('falls through to the next provider when the higher one did not set the field', () => {
    const plex = result(MetadataProviderType.PLEX, {
      _sourceIds: { radarr: 1 },
      title: 'M',
      playCount: 2,
    });

    const resolved = resolvePrecedence([plex], {
      playCount: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX],
    });

    expect(resolved[0].playCount).toBe(2);
  });

  it('merges fields contributed by different providers onto one item', () => {
    const tautulli = result(MetadataProviderType.TAUTULLI, {
      _sourceIds: { radarr: 1 },
      title: 'M',
      playCount: 5,
    });
    const overseerr = result(MetadataProviderType.OVERSEERR, {
      _sourceIds: { radarr: 1 },
      title: 'M',
      overseerrHasIssue: true,
    });

    const resolved = resolvePrecedence([tautulli, overseerr], {
      playCount: [MetadataProviderType.TAUTULLI],
      overseerrHasIssue: [MetadataProviderType.OVERSEERR],
    });

    expect(resolved[0]).toMatchObject({ playCount: 5, overseerrHasIssue: true });
  });
});
