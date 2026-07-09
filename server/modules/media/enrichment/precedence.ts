import { MetadataProviderType } from '../../../database/schema';
import type { EnrichableField, EnrichmentResult } from '../../providers';
import type { MediaItem } from '../mediaItem';

export type { EnrichableField };

/**
 * Per-field precedence: for each canonical field, the providers that may set it,
 * highest priority first. Two enrichers can speak to one field (play count from
 * Tautulli or Plex); precedence can differ per field, so this is a per-field map,
 * not a global enricher ordering.
 */
export type PrecedencePolicy = Partial<Record<EnrichableField, MetadataProviderType[]>>;

/**
 * The enrichment precedence in force. Play count and last-watched can come from
 * Tautulli or Plex — Tautulli wins (it tracks completed plays, not opens). The
 * remaining fields have a single authoritative enricher each.
 */
export const ENRICHMENT_POLICY: PrecedencePolicy = {
  playCount: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX],
  lastWatchedAt: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX],
  overseerrHasIssue: [MetadataProviderType.OVERSEERR],
  overseerrRequestStatus: [MetadataProviderType.OVERSEERR],
  tmdbStatus: [MetadataProviderType.TMDB],
};

/** A stable identity for a canonical item across results — its cross-provider keys. */
function identityKey(item: MediaItem): string {
  return JSON.stringify(item._sourceIds);
}

/**
 * Merge every enricher's contributions into one canonical item set. Items are
 * grouped by identity across results; each field in the policy is taken from the
 * highest-precedence provider that set it. Fields outside the policy carry their
 * decorated value through. Pure: the write-time replacement for read-time `??`
 * precedence chains.
 */
export function resolvePrecedence(
  results: EnrichmentResult[],
  policy: PrecedencePolicy
): MediaItem[] {
  const groups = new Map<
    string,
    { base: MediaItem; byProvider: Map<MetadataProviderType, MediaItem> }
  >();
  for (const { provider, items } of results) {
    for (const item of items) {
      const key = identityKey(item);
      let group = groups.get(key);
      if (!group) {
        group = { base: item, byProvider: new Map() };
        groups.set(key, group);
      }
      group.byProvider.set(provider, item);
    }
  }

  return [...groups.values()].map(({ base, byProvider }) => {
    const resolved: MediaItem = { ...base };
    for (const [field, order] of Object.entries(policy) as [
      EnrichableField,
      MetadataProviderType[],
    ][]) {
      for (const provider of order) {
        const contributor = byProvider.get(provider);
        if (contributor && contributor[field] != null) {
          (resolved as Record<EnrichableField, unknown>)[field] = contributor[field];
          break;
        }
      }
    }
    return resolved;
  });
}
