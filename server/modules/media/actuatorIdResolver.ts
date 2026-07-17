import { MetadataProviderType, mediaIdentity, mediaItems } from '@server/database/schema';
import type { DrizzleDb } from '@server/kernel/db';
import { and, eq, inArray, or } from 'drizzle-orm';
import { externalIdOf } from './mediaItem';
import type { MediaItem } from './mediaItem';

/**
 * The identity-graph column a non-source actuator addresses items by. Keyed by
 * addressing space, not provider: Tautulli has no id space of its own — it
 * reports entirely against Plex rating keys — so it shares Plex's column.
 */
const ADDRESS_COLUMN_BY_TYPE = {
  [MetadataProviderType.PLEX]: mediaIdentity.plexRatingKey,
  [MetadataProviderType.TAUTULLI]: mediaIdentity.plexRatingKey,
  [MetadataProviderType.JELLYFIN]: mediaIdentity.jellyfinItemId,
} as const;

type AddressedActuatorType = keyof typeof ADDRESS_COLUMN_BY_TYPE;

/**
 * Translates query-matched catalog items into a non-source actuator's own
 * addressing space: each item's `(providerId, externalId)` coordinate joins
 * through `media_item` to its `media_identity` group, whose Plex/Jellyfin
 * column carries the actuator-native id. Identities the resolution job has not
 * stamped yet drop out (no id to address), and multiple instance copies of one
 * identity collapse to a single id.
 */
export async function resolveActuatorIds(
  db: DrizzleDb,
  actuatorType: MetadataProviderType,
  items: MediaItem[]
): Promise<string[]> {
  const column = ADDRESS_COLUMN_BY_TYPE[actuatorType as AddressedActuatorType];
  if (!column) {
    throw new Error(`Provider type "${actuatorType}" has no actuator addressing space`);
  }

  const byProvider = new Map<number, number[]>();
  for (const item of items) {
    const providerId = item._sourceIds.providerId;
    const externalId = externalIdOf(item);
    if (providerId === undefined || externalId === undefined) continue;
    const group = byProvider.get(providerId) ?? [];
    group.push(externalId);
    byProvider.set(providerId, group);
  }
  if (byProvider.size === 0) return [];

  const rows = await db
    .selectDistinct({ nativeId: column })
    .from(mediaItems)
    .innerJoin(mediaIdentity, eq(mediaItems.mediaIdentityId, mediaIdentity.id))
    .where(
      or(
        ...[...byProvider.entries()].map(([providerId, externalIds]) =>
          and(eq(mediaItems.providerId, providerId), inArray(mediaItems.externalId, externalIds))
        )
      )
    );

  return rows.map((r) => r.nativeId).filter((id): id is string => id !== null);
}
