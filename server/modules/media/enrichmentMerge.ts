import { and, eq, inArray } from 'drizzle-orm';
import { mediaEnrichment, mediaItems, metadataProviders } from '../../database/schema';
import type { DrizzleDb } from '../../kernel/db';
import type { NormalizedMovie } from './movie';
import type { NormalizedShow } from './show';

/**
 * Maps `media_enrichment` rows onto Normalized* items, keyed by `sourceType` +
 * `sourceId` and resolved through the active instance's `media_item` copies to
 * the enrichment's owning group. The single source of truth for the
 * identity→enrichment merge, shared by the automation executor and the media
 * browse handler. Items without a matching item/enrichment row are left
 * untouched; null enrichment columns leave their field undefined.
 *
 * Assumes the single-active-provider invariant still holds for `sourceType`
 * (pre-multi-instance): at most one active instance owns the lookup.
 */
export async function mergeEnrichment<T extends NormalizedMovie | NormalizedShow>(
  db: DrizzleDb,
  items: T[],
  sourceType: 'RADARR' | 'SONARR',
  getSourceId: (item: T) => number | undefined
): Promise<void> {
  const sourceIds = items.map(getSourceId).filter((id): id is number => id !== undefined);
  if (sourceIds.length === 0) return;

  const activeProviders = await db
    .select({ id: metadataProviders.id })
    .from(metadataProviders)
    .where(and(eq(metadataProviders.type, sourceType), eq(metadataProviders.isActive, true)));
  if (activeProviders.length === 0) return;

  const identities = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        inArray(
          mediaItems.providerId,
          activeProviders.map((p) => p.id)
        ),
        inArray(mediaItems.externalId, sourceIds)
      )
    );
  if (identities.length === 0) return;

  const identityIdToSourceId = new Map(identities.map((i) => [i.mediaIdentityId, i.externalId]));
  const enrichments = await db
    .select()
    .from(mediaEnrichment)
    .where(
      inArray(
        mediaEnrichment.mediaIdentityId,
        identities.map((i) => i.mediaIdentityId)
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
    // Storage already holds write-time-resolved canonical values, so the read is a
    // straight copy: null means "unknown", which leaves the item field undefined.
    if (enr.playCount !== null) item.playCount = enr.playCount;
    if (enr.lastWatchedAt !== null) item.lastWatchedAt = enr.lastWatchedAt;
    if (enr.overseerrHasIssue !== null) item.overseerrHasIssue = enr.overseerrHasIssue;
    if (enr.overseerrRequestStatus !== null)
      item.overseerrRequestStatus = enr.overseerrRequestStatus;
    if (enr.tmdbStatus !== null) item.tmdbStatus = enr.tmdbStatus;
  }
}
