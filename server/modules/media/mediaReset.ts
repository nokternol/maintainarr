import { mediaIdentity } from '../../database/schema';
import type { DrizzleDb } from '../../kernel/db';

/**
 * Wipes every derived media row (`media_identity`, cascading to `media_item`
 * and `media_enrichment`) so it can be rebuilt from the source providers.
 * This module owns none of that data — it's a projection of Radarr/Sonarr/
 * Plex/etc — so a full rebuild-from-scratch is always a valid recovery path,
 * not just a development convenience. Provider configuration is untouched.
 */
export async function resetMediaData(db: DrizzleDb): Promise<{ deletedIdentities: number }> {
  const deleted = await db.delete(mediaIdentity).returning({ id: mediaIdentity.id });
  return { deletedIdentities: deleted.length };
}
