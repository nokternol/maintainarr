import { eq } from 'drizzle-orm';
import { mediaEnrichment, mediaIdentity } from '../../database/schema';
import type { DrizzleDb } from '../../kernel/db';
import type { MediaEnricher } from './enrichment/enricher';
import { ENRICHMENT_POLICY, resolvePrecedence } from './enrichment/precedence';
import type { MediaItem } from './mediaItem';

const STALENESS_SECONDS = 24 * 60 * 60;

interface Deps {
  db: DrizzleDb;
  enrichers?: MediaEnricher[];
}

/** A stable identity for a hydrated item — matches `resolvePrecedence`'s grouping key. */
function identityKey(item: MediaItem): string {
  return JSON.stringify(item._sourceIds);
}

/**
 * Project a group row into the canonical item the enrichers match and decorate.
 * No `radarr`/`sonarr` key: the group carries no per-instance coordinate, and no
 * enricher ever matched on those keys (verified in `enricherAdapters.ts`).
 */
function hydrate(identity: typeof mediaIdentity.$inferSelect): MediaItem {
  const ids: Record<string, number | string> = { identity: identity.id };
  if (identity.tmdbId != null) ids.tmdb = identity.tmdbId;
  if (identity.plexRatingKey != null) ids.plex = identity.plexRatingKey;
  if (identity.imdbId != null) ids.imdb = identity.imdbId;
  return { _sourceIds: ids, title: '' } as MediaItem;
}

export class EnrichmentJob {
  constructor(private deps: Deps) {}

  async run(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const staleThreshold = now - STALENESS_SECONDS;

    const rows = await this.deps.db
      .select({ identity: mediaIdentity, enrichment: mediaEnrichment })
      .from(mediaIdentity)
      .leftJoin(mediaEnrichment, eq(mediaEnrichment.mediaIdentityId, mediaIdentity.id));

    const toEnrich = rows.filter(
      ({ enrichment }) => !enrichment || (enrichment.enrichedAt ?? 0) < staleThreshold
    );
    if (toEnrich.length === 0) return 0;

    // Hydrate each stale identity into a canonical item, tracking the row to write back to.
    const hydrated = toEnrich.map(({ identity, enrichment }) => ({
      identityId: identity.id,
      hasRow: enrichment != null,
      item: hydrate(identity),
    }));
    const items = hydrated.map((h) => h.item);

    // Every enricher decorates the same batch; precedence resolves per field at write time.
    const enrichers = this.deps.enrichers ?? [];
    const results = await Promise.all(enrichers.map((e) => e.enrich(items)));
    const resolvedByKey = new Map(
      resolvePrecedence(results, ENRICHMENT_POLICY).map((item) => [identityKey(item), item])
    );

    for (const { identityId, hasRow, item } of hydrated) {
      const resolved = resolvedByKey.get(identityKey(item));
      const values = {
        playCount: resolved?.playCount ?? null,
        lastWatchedAt: resolved?.lastWatchedAt ?? null,
        overseerrRequestStatus: resolved?.overseerrRequestStatus ?? null,
        overseerrHasIssue: resolved?.overseerrHasIssue ?? null,
        tmdbStatus: resolved?.tmdbStatus ?? null,
      };

      if (hasRow) {
        await this.deps.db
          .update(mediaEnrichment)
          .set({ ...values, enrichedAt: now })
          .where(eq(mediaEnrichment.mediaIdentityId, identityId));
      } else {
        await this.deps.db
          .insert(mediaEnrichment)
          .values({ mediaIdentityId: identityId, ...values, enrichedAt: now });
      }
    }

    return toEnrich.length;
  }
}
