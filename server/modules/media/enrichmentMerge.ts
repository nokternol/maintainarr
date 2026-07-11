import { and, eq, inArray } from 'drizzle-orm';
import { mediaEnrichment, mediaItems } from '../../database/schema';
import type { DrizzleDb } from '../../kernel/db';
import { externalIdOf, itemKey } from './mediaItem';
import type { NormalizedMovie } from './movie';
import type { NormalizedShow } from './show';

/**
 * Maps `media_enrichment` rows onto Normalized* items, joined through each item's
 * own `_sourceIds.providerId`/native id to its `media_item` copy and from there to
 * the owning group. The single source of truth for the identity→enrichment merge,
 * shared by the automation executor and the media browse handler. A batch may span
 * multiple instances (grouped by `providerId` per query); items without a matching
 * item/enrichment row are left untouched. Two items from two instances that resolve
 * to the same group correctly read the same group-level enrichment — that is the
 * model, not a bug: watched-ness is a fact about the title, not the copy.
 */
export async function mergeEnrichment<T extends NormalizedMovie | NormalizedShow>(
  db: DrizzleDb,
  items: T[]
): Promise<void> {
  const byProvider = new Map<number, T[]>();
  for (const item of items) {
    const providerId = item._sourceIds.providerId;
    const externalId = externalIdOf(item);
    if (providerId === undefined || externalId === undefined) continue;
    const bucket = byProvider.get(providerId);
    if (bucket) bucket.push(item);
    else byProvider.set(providerId, [item]);
  }
  if (byProvider.size === 0) return;

  const mediaItemRows = (
    await Promise.all(
      [...byProvider.entries()].map(([providerId, providerItems]) =>
        db
          .select()
          .from(mediaItems)
          .where(
            and(
              eq(mediaItems.providerId, providerId),
              inArray(
                mediaItems.externalId,
                providerItems.map((item) => externalIdOf(item)!)
              )
            )
          )
      )
    )
  ).flat();
  if (mediaItemRows.length === 0) return;

  const groupIdByItemKey = new Map(
    mediaItemRows.map((row) => [`${row.providerId}:${row.externalId}`, row.mediaIdentityId])
  );
  const enrichments = await db
    .select()
    .from(mediaEnrichment)
    .where(
      inArray(
        mediaEnrichment.mediaIdentityId,
        mediaItemRows.map((row) => row.mediaIdentityId)
      )
    );
  const enrichmentByGroupId = new Map(enrichments.map((enr) => [enr.mediaIdentityId, enr]));

  for (const item of items) {
    const key = itemKey(item);
    if (key === undefined) continue;
    const groupId = groupIdByItemKey.get(key);
    if (groupId === undefined) continue;
    const enr = enrichmentByGroupId.get(groupId);
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
