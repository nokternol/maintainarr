import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { mediaEnrichment, mediaIdentity } from '../database/schema';
import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';

/**
 * Maps `media_enrichment` rows onto Normalized* items, keyed by
 * `sourceType` + `sourceId`. The single source of truth for the
 * identity→enrichment merge, shared by the automation executor and the
 * media browse handler. Items without a matching identity/enrichment row
 * are left untouched; null enrichment columns leave their field undefined.
 */
export async function mergeEnrichment<T extends NormalizedMovie | NormalizedShow>(
  db: DrizzleDb,
  items: T[],
  sourceType: 'RADARR' | 'SONARR',
  getSourceId: (item: T) => number | undefined
): Promise<void> {
  const sourceIds = items.map(getSourceId).filter((id): id is number => id !== undefined);
  if (sourceIds.length === 0) return;

  const identities = await db
    .select()
    .from(mediaIdentity)
    .where(
      and(eq(mediaIdentity.sourceType, sourceType), inArray(mediaIdentity.sourceId, sourceIds))
    );
  if (identities.length === 0) return;

  const identityIdToSourceId = new Map(identities.map((i) => [i.id, i.sourceId]));
  const enrichments = await db
    .select()
    .from(mediaEnrichment)
    .where(
      inArray(
        mediaEnrichment.mediaIdentityId,
        identities.map((i) => i.id)
      )
    );

  const enrichBySourceId = new Map<number, (typeof enrichments)[number]>();
  for (const enr of enrichments) {
    const sourceId = identityIdToSourceId.get(enr.mediaIdentityId);
    if (sourceId !== undefined) enrichBySourceId.set(sourceId, enr);
  }

  for (const item of items) {
    const id = getSourceId(item);
    if (id === undefined) continue;
    const enr = enrichBySourceId.get(id);
    if (!enr) continue;
    const rawPlay = enr.tautulliPlayCount ?? enr.plexViewCount ?? null;
    item.playCount = rawPlay !== null ? rawPlay : undefined;
    const rawTs = enr.tautulliLastPlayed ?? enr.plexLastViewedAt ?? null;
    item.lastWatchedAt = rawTs !== null ? new Date(rawTs * 1000).toISOString() : undefined;
    if (enr.overseerrHasIssue !== null) item.overseerrHasIssue = enr.overseerrHasIssue;
    if (enr.overseerrRequestStatus !== null)
      item.overseerrRequestStatus = enr.overseerrRequestStatus;
    if (enr.tmdbStatus !== null) item.tmdbStatus = enr.tmdbStatus ?? undefined;
  }
}
